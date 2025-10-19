import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Company,
  Employee,
  TimeEntry,
  WorkContext,
  CompanyEcosystem,
  EmployeeCompanyAssignment,
  TimesheetCompanyContext,
  CompanyHierarchy,
  ITKnechtImportContext,
  EcosystemConfig,
} from '../types';

/**
 * BUDDY ECOSYSTEM SERVICE
 * 
 * Centralized service voor het beheren van het Buddy ecosysteem.
 * Implementeert alle intelligente logica voor company management,
 * employee assignments, en timesheet context.
 */

export class BuddyEcosystemService {
  private userId: string;
  private config: EcosystemConfig;

  constructor(userId: string, config?: Partial<EcosystemConfig>) {
    this.userId = userId;
    this.config = {
      buddy: {
        autoAssignment: true,
        defaultWorkWeek: 40,
        companyPrefix: 'Buddy',
        ...config?.buddy
      },
      projects: {
        allowDynamicCreation: true,
        requireExplicitAssignment: false,
        inheritBuddySettings: true,
        ...config?.projects
      },
      timeTracking: {
        enableCrossCompany: true,
        requireCompanySelection: false,
        autoDetectCompany: true,
        allowCompanySwitching: true,
        ...config?.timeTracking
      },
      ui: {
        hideCompanySelectorWhenPossible: true,
        showSubtleCompanyIndicators: true,
        enableQuickCompanySwitch: true,
        ...config?.ui
      }
    };
  }

  /**
   * ECOSYSTEM INITIALIZATION
   */
  async initializeEcosystem(): Promise<CompanyEcosystem> {
    const companies = await this.getCompanies();
    
    // Find or create Buddy company
    let buddyCompany = companies.find(c => 
      c.companyType === 'employer' && 
      (c.name.toLowerCase().includes('buddy') || companies.filter(co => co.companyType === 'employer').length === 1)
    );

    if (!buddyCompany) {
      buddyCompany = await this.createBuddyCompany();
    }

    // Get project companies
    const projectCompanies = companies.filter(c => 
      c.companyType === 'project' && c.primaryEmployerId === buddyCompany.id
    );

    const ecosystem: CompanyEcosystem = {
      id: `ecosystem-${this.userId}`,
      userId: this.userId,
      name: 'Buddy Ecosystem',
      description: 'Centralized employee and project management',
      primaryEmployer: buddyCompany,
      projectCompanies,
      settings: {
        autoAssignToBuddy: this.config.buddy.autoAssignment,
        allowCrossCompanyTimeTracking: this.config.timeTracking.enableCrossCompany,
        centralizedPayroll: true
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return ecosystem;
  }

  /**
   * SMART EMPLOYEE CREATION
   */
  async createEmployeeWithBuddyDefaults(
    employeeData: Omit<Employee, 'id' | 'userId' | 'companyId' | 'projectCompanies'>
  ): Promise<Employee> {
    const ecosystem = await this.initializeEcosystem();
    
    const employee: Omit<Employee, 'id'> = {
      ...employeeData,
      userId: this.userId,
      companyId: ecosystem.primaryEmployer.id, // Auto-assign to Buddy
      projectCompanies: [], // Start empty, admin can assign later
      hasAccount: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'employees'), this.convertToTimestamps(employee));
    
    console.log(`✅ Employee ${employee.personalInfo.firstName} ${employee.personalInfo.lastName} auto-assigned to ${ecosystem.primaryEmployer.name}`);
    
    return {
      id: docRef.id,
      ...employee
    };
  }

  /**
   * PROJECT COMPANY ASSIGNMENT
   */
  async assignEmployeeToProjects(
    employeeId: string, 
    projectCompanyIds: string[]
  ): Promise<void> {
    const employee = await this.getEmployee(employeeId);
    if (!employee) throw new Error('Employee not found');

    // Validate project companies
    const companies = await this.getCompanies();
    const validProjects = companies.filter(c => 
      c.companyType === 'project' && projectCompanyIds.includes(c.id)
    );

    if (validProjects.length !== projectCompanyIds.length) {
      throw new Error('Invalid project companies provided');
    }

    // Update employee
    await updateDoc(doc(db, 'employees', employeeId), {
      projectCompanies: projectCompanyIds,
      updatedAt: new Date()
    });

    // Create assignment records for audit trail
    const batch = writeBatch(db);
    for (const projectId of projectCompanyIds) {
      const assignment: Omit<EmployeeCompanyAssignment, 'id'> = {
        employeeId,
        companyId: projectId,
        assignmentType: 'project',
        assignedBy: this.userId,
        assignedAt: new Date(),
        permissions: {
          canLogHours: true,
          canAccessReports: false,
          canViewPayslips: false
        },
        settings: {
          defaultHourType: 'project',
          autoSelectCompany: false
        }
      };

      const assignmentRef = doc(collection(db, 'employeeCompanyAssignments'));
      batch.set(assignmentRef, assignment);
    }

    await batch.commit();
    
    console.log(`✅ Employee assigned to ${validProjects.length} project companies`);
  }

  /**
   * WORK CONTEXT COMPUTATION
   */
  async getEmployeeWorkContext(employeeId: string): Promise<WorkContext> {
    const employee = await this.getEmployee(employeeId);
    if (!employee) throw new Error('Employee not found');

    const companies = await this.getCompanies();
    const primaryEmployer = companies.find(c => c.id === employee.companyId);
    
    if (!primaryEmployer) throw new Error('Primary employer not found');

    // Get available work companies
    const availableWorkCompanies = companies.filter(c => 
      c.id === employee.companyId || 
      (employee.projectCompanies && employee.projectCompanies.includes(c.id))
    );

    const capabilities = {
      canSwitchCompanies: availableWorkCompanies.length > 1,
      requiresCompanySelection: !this.config.ui.hideCompanySelectorWhenPossible || availableWorkCompanies.length > 1,
      hasMultipleAssignments: (employee.projectCompanies?.length ?? 0) > 0
    };

    const defaultBehavior = {
      autoSelectPrimary: this.config.buddy.autoAssignment,
      showCompanySelector: capabilities.requiresCompanySelection && !this.config.ui.hideCompanySelectorWhenPossible,
      enableQuickSwitch: this.config.ui.enableQuickCompanySwitch && capabilities.canSwitchCompanies
    };

    return {
      employee,
      primaryEmployer,
      availableWorkCompanies,
      currentWorkCompany: primaryEmployer, // Default to primary
      capabilities,
      defaultBehavior
    };
  }

  /**
   * SMART COMPANY DETECTION
   */
  async detectOptimalWorkCompany(
    employeeId: string,
    timeEntryData?: Partial<TimeEntry>,
    importSource?: 'itknecht' | 'manual' | 'api'
  ): Promise<Company | null> {
    const context = await this.getEmployeeWorkContext(employeeId);
    
    // If only one company available, use it
    if (context.availableWorkCompanies.length === 1) {
      return context.availableWorkCompanies[0];
    }

    // ITKnecht import detection
    if (importSource === 'itknecht') {
      const itKnechtCompany = context.availableWorkCompanies.find(c => 
        c.name.toLowerCase().includes('itknecht')
      );
      if (itKnechtCompany) return itKnechtCompany;
    }

    // Project code detection
    if (timeEntryData?.project) {
      const projectCode = timeEntryData.project.toLowerCase();
      const matchedCompany = context.availableWorkCompanies.find(c => 
        c.name.toLowerCase().includes(projectCode) ||
        c.kvk.includes(projectCode)
      );
      if (matchedCompany) return matchedCompany;
    }

    // Work activities analysis
    if (timeEntryData?.workActivities) {
      for (const activity of timeEntryData.workActivities) {
        if (activity.clientId) {
          // Match client to company
          const clientCompany = context.availableWorkCompanies.find(c => 
            c.name.toLowerCase().includes(activity.clientId.toLowerCase())
          );
          if (clientCompany) return clientCompany;
        }
      }
    }

    // Default to primary employer
    return context.primaryEmployer;
  }

  /**
   * TIMESHEET COMPANY CONTEXT
   */
  async getTimesheetCompanyContext(
    employeeId: string, 
    week: number, 
    year: number
  ): Promise<TimesheetCompanyContext> {
    const context = await this.getEmployeeWorkContext(employeeId);
    
    // Get existing time entries for this week
    const timeEntries = await this.getTimeEntriesForWeek(employeeId, week, year);
    
    // Group by company
    const companySessions = context.availableWorkCompanies.map(company => {
      const companyEntries = timeEntries.filter(entry => 
        (entry.workCompanyId === company.id) || 
        (!entry.workCompanyId && company.id === context.primaryEmployer.id)
      );
      
      const totalHours = companyEntries.reduce((sum, entry) => 
        sum + entry.regularHours + entry.overtimeHours, 0
      );

      return {
        companyId: company.id,
        company,
        totalHours,
        entries: companyEntries,
        isMainEmployer: company.id === context.primaryEmployer.id
      };
    });

    // Calculate summary
    const totalHours = companySessions.reduce((sum, session) => sum + session.totalHours, 0);
    const primaryEmployerHours = companySessions.find(s => s.isMainEmployer)?.totalHours ?? 0;
    const projectHours = totalHours - primaryEmployerHours;
    
    const distributionPercentage: { [companyId: string]: number } = {};
    companySessions.forEach(session => {
      distributionPercentage[session.companyId] = totalHours > 0 ? 
        (session.totalHours / totalHours) * 100 : 0;
    });

    return {
      employee: context.employee,
      week,
      year,
      companySessions,
      summary: {
        totalHours,
        primaryEmployerHours,
        projectHours,
        distributionPercentage
      }
    };
  }

  /**
   * SMART TIME ENTRY CREATION
   */
  async createSmartTimeEntry(
    employeeId: string,
    timeEntryData: Omit<TimeEntry, 'id' | 'userId' | 'employeeId' | 'workCompanyId'>,
    workCompanyId?: string
  ): Promise<TimeEntry> {
    const context = await this.getEmployeeWorkContext(employeeId);
    
    // Determine work company
    let effectiveWorkCompany: Company;
    
    if (workCompanyId) {
      // Explicit company provided - validate access
      const company = context.availableWorkCompanies.find(c => c.id === workCompanyId);
      if (!company) {
        throw new Error(`Employee is not authorized to work for company ${workCompanyId}`);
      }
      effectiveWorkCompany = company;
    } else {
      // Auto-detect optimal company
      const detected = await this.detectOptimalWorkCompany(employeeId, timeEntryData);
      effectiveWorkCompany = detected ?? context.primaryEmployer;
    }

    const timeEntry: Omit<TimeEntry, 'id'> = {
      ...timeEntryData,
      userId: this.userId,
      employeeId,
      workCompanyId: effectiveWorkCompany.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'timeEntries'), this.convertToTimestamps(timeEntry));
    
    return {
      id: docRef.id,
      ...timeEntry
    };
  }

  /**
   * ITKNECHT IMPORT WITH SMART DETECTION
   */
  async importITKnechtData(
    employeeId: string,
    week: number,
    year: number,
    rawData: any[]
  ): Promise<{
    success: boolean;
    importedEntries: TimeEntry[];
    detectedCompany?: Company;
    summary: string;
  }> {
    const context = await this.getEmployeeWorkContext(employeeId);
    
    // Detect ITKnecht company
    const itKnechtCompany = context.availableWorkCompanies.find(c => 
      c.name.toLowerCase().includes('itknecht')
    );

    if (!itKnechtCompany) {
      return {
        success: false,
        importedEntries: [],
        summary: 'Geen ITKnecht bedrijf gevonden voor deze werknemer'
      };
    }

    const importedEntries: TimeEntry[] = [];
    
    // Process raw data
    for (const dayData of rawData) {
      if (dayData.totaal_factuureerbare_uren > 0) {
        const timeEntry = await this.createSmartTimeEntry(
          employeeId,
          {
            date: new Date(dayData.datum),
            regularHours: dayData.totaal_factuureerbare_uren,
            overtimeHours: 0,
            irregularHours: 0,
            travelKilometers: dayData.gereden_kilometers || 0,
            branchId: context.employee.branchId,
            notes: `ITKnecht import: ${dayData.omschrijving || 'Werkzaamheden'}`,
            status: 'draft',
            workActivities: [{
              hours: dayData.totaal_factuureerbare_uren,
              description: dayData.omschrijving || 'ITKnecht werkzaamheden',
              clientId: dayData.klant_code,
              projectCode: dayData.project_code,
              isITKnechtImport: true
            }]
          },
          itKnechtCompany.id
        );
        
        importedEntries.push(timeEntry);
      }
    }

    return {
      success: true,
      importedEntries,
      detectedCompany: itKnechtCompany,
      summary: `${importedEntries.length} uren geïmporteerd voor ${itKnechtCompany.name}`
    };
  }

  /**
   * COMPANY HIERARCHY MANAGEMENT
   */
  async getCompanyHierarchy(): Promise<CompanyHierarchy[]> {
    const companies = await this.getCompanies();
    const employees = await this.getEmployees();
    
    const employerCompanies = companies.filter(c => c.companyType === 'employer');
    
    const hierarchies: CompanyHierarchy[] = [];
    
    for (const employer of employerCompanies) {
      const projectCompanies = companies.filter(c => 
        c.companyType === 'project' && c.primaryEmployerId === employer.id
      );
      
      const employerEmployees = employees.filter(emp => emp.companyId === employer.id);
      
      // Calculate statistics
      const totalEmployees = employerEmployees.length;
      const activeProjects = projectCompanies.length;
      
      // Employee project assignments
      const employeeProjectAssignments: { [employeeId: string]: string[] } = {};
      employerEmployees.forEach(emp => {
        if (emp.projectCompanies && emp.projectCompanies.length > 0) {
          employeeProjectAssignments[emp.id] = emp.projectCompanies;
        }
      });
      
      // TODO: Calculate monthly hours and revenue from time entries
      const monthlyHours = 0; // Implement based on current month time entries
      const revenue = 0; // Implement based on billing rates
      
      const projectHourDistribution: { [projectId: string]: number } = {};
      // TODO: Implement based on time entries per project
      
      hierarchies.push({
        employer,
        projectCompanies,
        employees: employerEmployees,
        statistics: {
          totalEmployees,
          activeProjects,
          monthlyHours,
          revenue
        },
        relationships: {
          employeeProjectAssignments,
          projectHourDistribution
        }
      });
    }
    
    return hierarchies;
  }

  /**
   * VALIDATION & BUSINESS RULES
   */
  async validateCrossCompanyTimeEntry(timeEntry: TimeEntry): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const context = await this.getEmployeeWorkContext(timeEntry.employeeId);
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Validate company access
    if (timeEntry.workCompanyId) {
      const hasAccess = context.availableWorkCompanies.some(c => c.id === timeEntry.workCompanyId);
      if (!hasAccess) {
        issues.push(`Employee heeft geen toegang tot bedrijf ${timeEntry.workCompanyId}`);
      }
    }

    // Validate hour limits
    const weekContext = await this.getTimesheetCompanyContext(
      timeEntry.employeeId, 
      this.getWeekNumber(timeEntry.date), 
      timeEntry.date.getFullYear()
    );
    
    const totalWeekHours = weekContext.summary.totalHours + timeEntry.regularHours + timeEntry.overtimeHours;
    
    if (totalWeekHours > context.employee.contractInfo.hoursPerWeek * 1.5) {
      issues.push('Week uren overschrijden 150% van contract uren');
      suggestions.push('Controleer of alle uren correct zijn ingevuld');
    }

    // Project company validation
    if (timeEntry.workCompanyId !== context.employee.companyId) {
      const projectCompany = context.availableWorkCompanies.find(c => c.id === timeEntry.workCompanyId);
      if (projectCompany && !timeEntry.project) {
        suggestions.push(`Voeg een projectcode toe voor werk bij ${projectCompany.name}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * UTILITY METHODS
   */
  private async createBuddyCompany(): Promise<Company> {
    const buddyCompany: Omit<Company, 'id'> = {
      userId: this.userId,
      name: 'Buddy BV',
      kvk: '00000000',
      taxNumber: 'NL000000000B01',
      companyType: 'employer',
      address: {
        street: 'Hoofdstraat 1',
        city: 'Amsterdam',
        zipCode: '1000 AA',
        country: 'Nederland'
      },
      contactInfo: {
        email: 'info@buddy.nl',
        phone: '020-1234567'
      },
      settings: {
        defaultCAO: 'Algemeen',
        travelAllowancePerKm: 0.23,
        standardWorkWeek: this.config.buddy.defaultWorkWeek,
        holidayAllowancePercentage: 8,
        pensionContributionPercentage: 3
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'companies'), this.convertToTimestamps(buddyCompany));
    
    return {
      id: docRef.id,
      ...buddyCompany
    };
  }

  private async getCompanies(): Promise<Company[]> {
    const q = query(
      collection(db, 'companies'),
      where('userId', '==', this.userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...this.convertTimestamps(doc.data())
    } as Company));
  }

  private async getEmployees(): Promise<Employee[]> {
    const q = query(
      collection(db, 'employees'),
      where('userId', '==', this.userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...this.convertTimestamps(doc.data())
    } as Employee));
  }

  private async getEmployee(employeeId: string): Promise<Employee | null> {
    const docRef = doc(db, 'employees', employeeId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    if (data.userId !== this.userId) {
      throw new Error('Unauthorized');
    }
    
    return {
      id: docSnap.id,
      ...this.convertTimestamps(data)
    } as Employee;
  }

  private async getTimeEntriesForWeek(employeeId: string, week: number, year: number): Promise<TimeEntry[]> {
    // Implementation to fetch time entries for specific week
    const weekDates = this.getWeekDates(year, week);
    const startDate = weekDates[0];
    const endDate = weekDates[6];
    
    const q = query(
      collection(db, 'timeEntries'),
      where('userId', '==', this.userId),
      where('employeeId', '==', employeeId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...this.convertTimestamps(doc.data())
    } as TimeEntry));
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getWeekDates(year: number, weekNumber: number): Date[] {
    const jan4 = new Date(year, 0, 4);
    const firstMonday = new Date(jan4.getTime() - (jan4.getDay() - 1) * 86400000);
    const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400000);

    return Array.from({ length: 7 }, (_, i) =>
      new Date(weekStart.getTime() + i * 86400000)
    );
  }

  private convertToTimestamps(data: any): any {
    const converted = { ...data };
    
    if (converted.createdAt instanceof Date) {
      converted.createdAt = converted.createdAt;
    }
    if (converted.updatedAt instanceof Date) {
      converted.updatedAt = converted.updatedAt;
    }
    if (converted.date instanceof Date) {
      converted.date = converted.date;
    }
    
    return converted;
  }
}

/**
 * FACTORY FUNCTION
 */
export const createBuddyEcosystemService = (
  userId: string, 
  config?: Partial<EcosystemConfig>
): BuddyEcosystemService => {
  return new BuddyEcosystemService(userId, config);
};

/**
 * SINGLETON PATTERN FOR GLOBAL ACCESS
 */
let ecosystemServiceInstance: BuddyEcosystemService | null = null;

export const getBuddyEcosystemService = (
  userId?: string, 
  config?: Partial<EcosystemConfig>
): BuddyEcosystemService => {
  if (!ecosystemServiceInstance && userId) {
    ecosystemServiceInstance = new BuddyEcosystemService(userId, config);
  }
  
  if (!ecosystemServiceInstance) {
    throw new Error('BuddyEcosystemService not initialized. Provide userId on first call.');
  }
  
  return ecosystemServiceInstance;
};

/**
 * RESET FOR TESTING/LOGOUT
 */
export const resetBuddyEcosystemService = (): void => {
  ecosystemServiceInstance = null;
};