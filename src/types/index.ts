export interface Company {
  id: string;
  userId: string;
  name: string;
  kvk: string;
  taxNumber: string;

  // ✅ AANGEPAST: Loonmaatschappij vs Werkmaatschappij structuur
  companyType: 'payroll_company' | 'work_company';
  payrollCompanyId?: string; // Voor work companies - verwijst naar loonmaatschappij

  // ✅ NIEUW: Toegangsbeheer - managers/gebruikers die toegang hebben tot dit bedrijf
  allowedUsers?: string[]; // Array van user UIDs die toegang hebben tot dit bedrijf

  address: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  settings: {
    defaultCAO: string;
    travelAllowancePerKm: number;
    standardWorkWeek: number;
    holidayAllowancePercentage: number;
    pensionContributionPercentage: number;
  };
  logoUrl?: string;
  themeColor?: string; // Primary color for this company (e.g., 'blue', 'green', 'purple')
  createdAt: Date;
  updatedAt: Date;
  mainBranchId?: string;
}

export interface Branch {
  id: string;
  userId: string;
  companyId: string;
  name: string;
  location: string;
  costCenter: string;
  cao?: string;
  specificSettings?: {
    overtimeRate: number;
    irregularRate: number;
    shiftRate: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  payrollCompanyId: string; // ✅ AANGEPAST: Verwijst naar loonmaatschappij (Buddy)
  branchId: string;
  
  // ✅ AANGEPAST: Werkmaatschappijen waar employee voor werkt
  workCompanies?: string[]; // Array van work company IDs
  
  personalInfo: {
    firstName: string;
    lastName: string;
    initials: string;
    bsn: string;
    dateOfBirth: Date;
    placeOfBirth: string;
    nationality: string;
    
    address: {
      street: string;
      houseNumber: string;
      houseNumberAddition?: string;
      postalCode: string;
      city: string;
      country: string;
    };
    
    contactInfo: {
      email: string;
      phone: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
      };
    };
    
    bankAccount: string;
    maritalStatus: 'single' | 'married' | 'registered_partnership' | 'divorced' | 'widowed';
    identityDocument?: string;
  };
  
  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
    startDate: Date;
    endDate?: Date;
    probationPeriod?: number;
    hoursPerWeek: number;
    position: string;
    department?: string;
    costCenter?: string;
    
    cao: string;
    caoCode?: string;
    
    contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
    noticeDate?: Date;
    endReason?: string;
  };
  
  salaryInfo: {
    salaryScale: string;
    
    hourlyRate?: number;
    monthlySalary?: number;
    annualSalary?: number;
    
    paymentType: 'hourly' | 'monthly' | 'annual';
    paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
    
    allowances: {
      overtime: number;
      irregular: number;
      shift: number;
      evening: number;
      night: number;
      weekend: number;
      sunday: number;
    };
    
    travelAllowancePerKm: number;
    phoneAllowance?: number;
    internetAllowance?: number;
    
    taxTable: 'white' | 'green';
    taxCredit: boolean;
    socialSecurityNumber?: string;
  };
  
  leaveInfo: {
    vacation: {
      entitlement: number;
      accrued: number;
      taken: number;
      remaining: number;
    };
    
    adv?: {
      accumulated: number;
      taken: number;
      remaining: number;
    };
    
    seniorDays?: number;
    snipperDays?: number;
  };
  
  status: 'active' | 'inactive' | 'on_leave' | 'sick';
  
  hasAccount: boolean;
  accountCreatedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  salaryHistory?: {
    date: Date;
    oldValue: number;
    newValue: number;
    reason: string;
    changedBy: string;
  }[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  employeeId: string;
  
  // ✅ AANGEPAST: Voor welke werkmaatschappij wordt gewerkt
  workCompanyId?: string; // Voor welk werkbedrijf wordt dit uur geregistreerd
  
  date: Date;
  regularHours: number;
  overtimeHours: number;
  irregularHours: number;
  travelKilometers: number;
  project?: string;
  branchId: string;
  notes?: string;
  
  // ✅ ENHANCED: Work activities voor detailed tracking
  workActivities?: {
    hours: number;
    description: string;
    clientId?: string;
    projectCode?: string;
    isITKnechtImport?: boolean;
  }[];
  
  status: 'draft' | 'approved' | 'processed';
  createdAt: Date;
  updatedAt: Date;
}

// ✅ AANGEPAST: Buddy Ecosystem management met loonmaatschappij/werkmaatschappij
export interface BuddyEcosystem {
  id: string;
  userId: string;
  name: string; // "Buddy Ecosystem"
  description?: string;
  
  payrollCompany: Company; // ✅ Buddy BV (loonmaatschappij)
  workCompanies: Company[]; // ✅ Alle werkmaatschappijen
  
  settings: {
    autoAssignToBuddy: boolean;
    allowCrossCompanyTimeTracking: boolean;
    centralizedPayroll: boolean;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeCompanyAssignment {
  id: string;
  employeeId: string;
  companyId: string;
  assignmentType: 'payroll' | 'work'; // ✅ AANGEPAST: payroll vs work
  assignedBy: string;
  assignedAt: Date;
  
  permissions: {
    canLogHours: boolean;
    canAccessReports: boolean;
    canViewPayslips: boolean;
  };
  
  settings: {
    defaultHourType: 'regular' | 'project';
    autoSelectCompany: boolean;
  };
}

export interface WorkContext {
  employee: Employee;
  payrollCompany: Company; // ✅ AANGEPAST: Loonmaatschappij (Buddy)
  availableWorkCompanies: Company[]; // ✅ AANGEPAST: Beschikbare werkmaatschappijen
  currentWorkCompany?: Company;
  
  capabilities: {
    canSwitchCompanies: boolean;
    requiresCompanySelection: boolean;
    hasMultipleAssignments: boolean;
  };
  
  defaultBehavior: {
    autoSelectPayroll: boolean; // ✅ AANGEPAST
    showCompanySelector: boolean;
    enableQuickSwitch: boolean;
  };
}

// ✅ ENHANCED: Smart timesheet interfaces
export interface SmartTimesheetEntry extends TimeEntry {
  detectedCompany?: Company;
  suggestedCompany?: Company;
  companyDetectionSource: 'manual' | 'auto' | 'import' | 'ai';
  
  validation: {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  };
}

export interface TimesheetCompanyContext {
  employee: Employee;
  week: number;
  year: number;
  
  companySessions: {
    companyId: string;
    company: Company;
    totalHours: number;
    entries: TimeEntry[];
    isPayrollCompany: boolean; // ✅ AANGEPAST
  }[];
  
  summary: {
    totalHours: number;
    payrollCompanyHours: number; // ✅ AANGEPAST
    workCompanyHours: number; // ✅ AANGEPAST
    distributionPercentage: { [companyId: string]: number };
  };
}

// ✅ AANGEPAST: Company management met loonmaatschappij focus
export interface CompanyHierarchy {
  payrollCompany: Company; // ✅ Buddy BV
  workCompanies: Company[]; // ✅ Werkmaatschappijen
  employees: Employee[];
  
  statistics: {
    totalEmployees: number;
    activeWorkCompanies: number; // ✅ AANGEPAST
    monthlyHours: number;
    revenue: number;
  };
  
  relationships: {
    employeeWorkAssignments: { [employeeId: string]: string[] }; // ✅ AANGEPAST
    workCompanyHourDistribution: { [workCompanyId: string]: number }; // ✅ AANGEPAST
  };
}

// ✅ AANGEPAST: Helper interfaces
export interface PayrollCompanyWithEmployees extends Company {
  employees?: Employee[];
  workCompanies?: Company[]; // ✅ AANGEPAST
}

export interface EmployeeWithCompanies extends Employee {
  payrollCompanyData?: Company; // ✅ AANGEPAST
  workCompaniesData?: Company[]; // ✅ AANGEPAST
  workContext?: WorkContext;
}

export interface TimeEntryWithCompanyInfo extends TimeEntry {
  workCompany?: Company;
  payrollCompany?: Company; // ✅ AANGEPAST
  detectedProject?: string;
}

// ✅ AANGEPAST: Service interfaces voor business logic
export interface BuddyEcosystemManager {
  autoAssignEmployeeToBuddy(employee: Omit<Employee, 'id' | 'payrollCompanyId'>): Promise<Employee>;
  assignEmployeeToWorkCompanies(employeeId: string, workCompanyIds: string[]): Promise<void>; // ✅ AANGEPAST
  getEmployeeWorkContext(employeeId: string): Promise<WorkContext>;
  detectOptimalWorkCompany(timeEntry: Partial<TimeEntry>): Promise<Company | null>;
  validateCrossCompanyTimeEntry(timeEntry: TimeEntry): Promise<{ isValid: boolean; issues: string[] }>;
}

export interface SmartCompanySelector {
  shouldShowSelector(context: WorkContext): boolean;
  getDefaultCompany(context: WorkContext): Company;
  getAvailableCompanies(context: WorkContext): Company[];
  autoSelectCompany(context: WorkContext, timeEntry?: Partial<TimeEntry>): Company | null;
}

// ✅ AANGEPAST: Configuration interfaces
export interface EcosystemConfig {
  buddy: {
    autoAssignment: boolean;
    isDefaultPayrollCompany: boolean; // ✅ AANGEPAST
    allowDirectHourRegistration: boolean;
  };
  
  workCompanies: { // ✅ AANGEPAST
    requireExplicitAssignment: boolean;
    allowIndependentTimeTracking: boolean;
    inheritPayrollSettings: boolean;
  };
  
  timeTracking: {
    defaultToPayrollCompany: boolean; // ✅ AANGEPAST
    allowCrossCompanyHours: boolean;
    requireWorkCompanySelection: boolean; // ✅ AANGEPAST
  };
  
  payroll: {
    centralizedProcessing: boolean;
    allowWorkCompanySpecificRates: boolean; // ✅ AANGEPAST
    autoCalculateCrossCharges: boolean;
  };
}

// ✅ NIEUW: User Settings interface
export interface UserSettings {
  id?: string;
  userId: string;
  defaultCompanyId?: string;  // Default bedrijf dat wordt geladen
  coAdminEmails?: string[];  // List of co-admins who have access to this user's companies
  email?: string;  // User's email address
  createdAt: Date;
  updatedAt: Date;
}

// ✅ NIEUW: Budget/Begroting voor terugkerende kosten EN inkomsten
export type BudgetType = 'cost' | 'income';
export type BudgetCostCategory = 'telecom' | 'software' | 'vehicle' | 'insurance' | 'utilities' | 'subscriptions' | 'personnel' | 'marketing' | 'office' | 'other';
export type BudgetIncomeCategory = 'services' | 'products' | 'subscriptions' | 'consulting' | 'licensing' | 'partnerships' | 'grants' | 'other';
export type BudgetCategory = BudgetCostCategory | BudgetIncomeCategory;
export type BudgetFrequency = 'monthly' | 'quarterly' | 'yearly';

// Confidence level voor projecties (investeerder presentaties)
export type ProjectionConfidence = 'confirmed' | 'likely' | 'potential' | 'speculative';

export interface BudgetItem {
  id: string;
  userId: string;
  companyId: string;
  type: BudgetType;                // 'cost' of 'income'
  name: string;                    // "KPN Telefoon", "Microsoft 365", "SaaS Klant A", etc.
  category: BudgetCategory;
  amount: number;                  // Bedrag per periode
  frequency: BudgetFrequency;
  startDate: Date;
  endDate?: Date;                  // Optioneel, voor tijdelijke kosten/inkomsten
  supplier?: string;               // Leverancier (voor kosten) of Klant (voor inkomsten)
  contractNumber?: string;
  notes?: string;
  isActive: boolean;
  // Projectie velden voor investeerder presentaties
  confidence?: ProjectionConfidence;  // Zekerheid van de inkomst/kost
  growthRate?: number;             // Verwachte groei % per jaar
  createdAt: Date;
  updatedAt: Date;
}

// Alle overige interfaces blijven hetzelfde...
export interface AuditLog {
  id: string;
  userId: string;
  employeeId?: string;
  companyId?: string;
  action: string;
  description: string;
  entityType: 'employee' | 'company' | 'timesheet' | 'payroll' | 'expense' | 'leave' | 'contract';
  entityId: string;
  changes?: {
    before: any;
    after: any;
  };
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
  };
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  employeeId?: string;
  companyId?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'payroll' | 'timesheet' | 'leave' | 'expense' | 'contract' | 'system' | 'compliance';
  isRead: boolean;
  readAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  actionText?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  expiresAt?: Date;
  metadata?: {
    relatedEntityType?: string;
    relatedEntityId?: string;
    automatedAction?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceUpdate {
  id: string;
  title: string;
  description: string;
  category: 'tax' | 'minimum-wage' | 'pension' | 'cao' | 'other';
  effectiveDate: Date;
  endDate?: Date;
  sourceUrl: string;
  isNew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  activeEmployees: number;
  totalGrossThisMonth: number;
  companiesCount: number;
  branchesCount: number;
  pendingApprovals: number;
}

export interface CAO {
  id: string;
  name: string;
  code: string;
  sector: string;
  description: string;
  
  salaryScales: {
    scale: string;
    hourlyRates: { [key: string]: number };
    monthlyRates: { [key: string]: number };
  }[];
  
  allowances: {
    overtime: number;
    irregular: number;
    shift: number;
    weekend: number;
    evening?: number;
    night?: number;
    sunday?: number;
  };
  
  travelAllowancePerKm: number;
  holidayAllowancePercentage: number;
  
  holidayDaysFormula: string;
  extraDays?: number;
  
  pensionFund?: string;
  pensionAge: number;
  pensionContribution: {
    employee: number;
    employer: number;
  };
  
  specialProvisions?: string[];
  
  effectiveDate: Date;
  endDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  id: string;
  uid: string;
  role: 'admin' | 'employee';
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  type: 'holiday' | 'sick' | 'special' | 'unpaid' | 'parental' | 'care' | 'short_leave' | 'adv';
  startDate: Date;
  endDate: Date;
  totalDays: number;
  totalHours: number;
  partialDay?: {
    date: Date;
    startTime: string;
    endTime: string;
    hours: number;
  };
  reason?: string;
  notes?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: Date;
  rejectedReason?: string;
  sickLeaveDetails?: {
    reportedAt: Date;
    reportedBy: string;
    expectedReturn?: Date;
    actualReturn?: Date;
    doctorNote?: string;
    percentage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalance {
  id?: string;
  employeeId: string;
  companyId: string;
  year: number;
  holidayDays: {
    statutory: number;
    extraStatutory: number;
    carried: number;
    accumulated: number;
    taken: number;
    pending: number;
    remaining: number;
    expires: Date;
  };
  advDays?: {
    entitled: number;
    accumulated: number;
    taken: number;
    remaining: number;
  };
  seniorDays: number;
  snipperDays: number;
  updatedAt: Date;
}

export type LeaveType = LeaveRequest['type'];
export type LeaveStatus = LeaveRequest['status'];

export interface SickLeave {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  startDate: Date;
  reportedAt: Date;
  reportedBy: string;
  reportedVia: 'phone' | 'email' | 'app' | 'in_person';
  endDate?: Date;
  actualReturnDate?: Date;
  status: 'active' | 'recovered' | 'partially_recovered' | 'long_term';
  workCapacityPercentage: number;
  reintegration?: {
    startDate: Date;
    plan: string;
    targetDate: Date;
    progress: string;
    meetingDates: Date[];
  };
  doctorVisits: {
    date: Date;
    doctor: string;
    notes?: string;
    certificate?: string;
  }[];
  arboServiceContacted: boolean;
  arboServiceDate?: Date;
  arboAdvice?: string;
  poortwachterActive: boolean;
  poortwachterMilestones?: {
    week: number;
    action: string;
    completedDate?: Date;
    status: 'pending' | 'completed' | 'overdue';
    dueDate: Date;
  }[];
  wiaApplication?: {
    appliedDate: Date;
    decision?: 'approved' | 'rejected' | 'pending';
    percentage?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AbsenceStatistics {
  totalAbsenceDays: number;
  totalAbsenceHours: number;
  absencePercentage: number;
  averageAbsenceDuration: number;
  sickLeaveFrequency: number;
  currentAbsences: number;
  longestAbsence: number;
  absencesByMonth: { [month: string]: number };
  absencesByType: { [type: string]: number };
  repeatAbsences: number;
}

export interface Expense {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;
  type: 'travel' | 'meal' | 'accommodation' | 'equipment' | 'training' | 'phone' | 'internet' | 'fuel' | 'parking' | 'public_transport' | 'other';
  description: string;
  amount: number;
  currency: string;
  date: Date;
  category: string;
  project?: string;
  client?: string;
  vehicle?: {
    type: VehicleType;
    licensePlate?: string;
    startLocation: string;
    endLocation: string;
    distance: number;
    hasReceipt: boolean;
  };
  receipt?: {
    filename: string;
    url: string;
    uploadedAt: Date;
  };
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  reimbursementDetails?: {
    method: 'bank_transfer' | 'cash' | 'payroll';
    reference: string;
    paidAt: Date;
    paidBy: string;
  };
  reviewHistory: {
    date: Date;
    action: 'submitted' | 'approved' | 'rejected' | 'paid';
    by: string;
    comment?: string;
  }[];
  paidInPayroll?: {
    payrollRunId: string;
    payrollDate: Date;
  };
  taxable: boolean;
  withinTaxFreeAllowance: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseType = Expense['type'];
export type ExpenseStatus = Expense['status'];
export type VehicleType = 'car' | 'bike' | 'public_transport' | 'taxi';

export type PayrollPeriodType = 'weekly' | 'bi-weekly' | 'monthly';
export type PayrollStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'finalized';

export interface PayrollPeriod {
  id?: string;
  userId: string;
  companyId: string;
  periodType: PayrollPeriodType;
  startDate: Date;
  endDate: Date;
  paymentDate: Date;
  status: PayrollStatus;
  employeeCount: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollEarning {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  isTaxable: boolean;
}

export interface PayrollDeduction {
  description: string;
  amount: number;
  isPreTax: boolean;
}

export interface PayrollTaxes {
  incomeTax: number;
  socialSecurityEmployee: number;
  socialSecurityEmployer: number;
  healthInsurance: number;
  pensionEmployee: number;
  pensionEmployer: number;
  unemploymentInsurance: number;
  disabilityInsurance: number;
}

export interface HourlyRate {
  id?: string;
  userId: string;
  companyId: string;
  jobTitle: string;
  baseRate: number;
  overtimeMultiplier: number;
  eveningMultiplier: number;
  nightMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  effectiveDate: Date;
  caoName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Allowance {
  id?: string;
  userId: string;
  companyId: string;
  name: string;
  type: 'shift' | 'irregular' | 'on-call' | 'travel' | 'other';
  amount: number;
  isPercentage: boolean;
  isTaxable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deduction {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  name: string;
  type: 'advance' | 'loan' | 'garnishment' | 'other';
  amount: number;
  isRecurring: boolean;
  startDate: Date;
  endDate?: Date;
  remainingAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxReturn {
  id: string;
  userId: string;
  companyId: string;
  period: {
    month: number;
    year: number;
  };
  status: 'draft' | 'submitted' | 'approved' | 'filed';
  data: any;
  submittedAt?: Date;
  filedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}