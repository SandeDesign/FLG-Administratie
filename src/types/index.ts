export interface Company {
  id: string;
  userId: string;
  name: string;
  kvk: string;
  taxNumber: string;
  
  // ✅ NIEUW: Bedrijfstype voor hybride model
  companyType: 'employer' | 'project';
  
  // ✅ NIEUW: Voor project companies - link naar primaire werkgever
  primaryEmployerId?: string;
  
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
  createdAt: Date;
  updatedAt: Date;
  mainBranchId?: string; // ID van de hoofd vestiging
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
  companyId: string; // Dit blijft de primaire werkgever (meestal Buddy BV)
  branchId: string;
  
  // ✅ NIEUW: Project bedrijven waar werknemer voor werkt
  projectCompanies?: string[]; // Array van company IDs
  
  // PERSOONLIJKE GEGEVENS (uitgebreid)
  personalInfo: {
    firstName: string;
    lastName: string;
    initials: string;
    bsn: string; // VERPLICHT - Burgerservicenummer (11-proef validatie)
    dateOfBirth: Date;
    placeOfBirth: string;
    nationality: string;
    
    address: {
      street: string;
      houseNumber: string;
      houseNumberAddition?: string;
      postalCode: string; // Format: 1234 AB
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
    
    // Kopie identiteitsbewijs (bestandsnaam/URL)
    identityDocument?: string;
  };
  
  // CONTRACT INFORMATIE (uitgebreid)
  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero_hours' | 'on_call' | 'intern' | 'dga' | 'payroll' | 'freelance';
    startDate: Date;
    endDate?: Date; // Verplicht bij temporary
    probationPeriod?: number; // In maanden
    hoursPerWeek: number;
    position: string;
    department?: string;
    costCenter?: string;
    
    // CAO informatie
    cao: string; // Bijv. "Bouw", "Horeca", "Zorg", "Metaal", "Algemeen"
    caoCode?: string;
    
    // Contract status
    contractStatus: 'active' | 'notice_period' | 'ended' | 'suspended';
    noticeDate?: Date; // Datum opzegging
    endReason?: string; // Reden einde contract
  };
  
  // LOON GEGEVENS (uitgebreid)
  salaryInfo: {
    salaryScale: string; // A-F of custom
    
    // Primair loon
    hourlyRate?: number;
    monthlySalary?: number;
    annualSalary?: number;
    
    // Type loon
    paymentType: 'hourly' | 'monthly' | 'annual';
    paymentFrequency: 'monthly' | 'four_weekly' | 'weekly';
    
    // Toeslagen percentages
    allowances: {
      overtime: number; // % (bijv. 125 voor 25% toeslag)
      irregular: number; // % voor onregelmatigheidstoeslagen
      shift: number; // % voor ploegentoeslag
      evening: number; // % voor avondtoeslag
      night: number; // % voor nachttoeslag
      weekend: number; // % voor weekendtoeslag
      sunday: number; // % voor zondagtoeslag
    };
    
    // Vergoedingen
    travelAllowancePerKm: number; // In euros
    phoneAllowance?: number; // Maandelijks
    internetAllowance?: number; // Maandelijks
    
    // Belastinggegevens
    taxTable: 'white' | 'green'; // Witboek of groenboek
    taxCredit: boolean; // Of arbeidskorting van toepassing is
    socialSecurityNumber?: string; // Sofi-nummer voor belastingaangifte
  };
  
  // VERLOF EN ZIEKTE
  leaveInfo: {
    // Vakantiedagen (per kalenderjaar)
    vacation: {
      entitlement: number; // Aantal dagen per jaar
      accrued: number; // Opgebouwd tot nu toe
      taken: number; // Opgenomen tot nu toe
      remaining: number; // Resterend
    };
    
    // Adv dagen (als van toepassing)
    adv?: {
      accumulated: number;
      taken: number;
      remaining: number;
    };
    
    // Overige dagen
    seniorDays?: number;
    snipperDays?: number;
  };
  
  status: 'active' | 'inactive' | 'on_leave' | 'sick';
  
  // Account informatie
  hasAccount: boolean; // Of werknemer een gebruikersaccount heeft
  accountCreatedAt?: Date; // Wanneer account is aangemaakt
  
  createdAt: Date;
  updatedAt: Date;
  
  // Historie
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
  
  // ✅ NIEUW: Voor welk bedrijf is dit uur geregistreerd (project company)
  workCompanyId?: string; // Als leeg, dan voor primaire werkgever
  
  date: Date;
  regularHours: number;
  overtimeHours: number;
  irregularHours: number;
  travelKilometers: number;
  project?: string;
  branchId: string;
  status: 'draft' | 'approved' | 'processed';
  createdAt: Date;
  updatedAt: Date;
}

export interface PayrollCalculation {
  id: string;
  userId: string;
  employeeId: string;
  period: {
    month: number;
    year: number;
  };
  gross: {
    baseSalary: number;
    overtime: number;
    irregularHours: number;
    shift: number;
    total: number;
  };
  allowances: {
    travel: number;
    holiday: number;
    total: number;
  };
  deductions: {
    tax: number;
    pension: number;
    other: number;
    total: number;
  };
  net: number;
  breakdown: any[];
  status: 'calculated' | 'approved' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}

export interface Regulation {
  id: string;
  userId: string;
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
  
  // Loonschalen
  salaryScales: {
    scale: string;
    hourlyRates: { [key: string]: number };
    monthlyRates: { [key: string]: number };
  }[];
  
  // Toeslagen
  allowances: {
    overtime: number;
    irregular: number;
    shift: number;
    weekend: number;
    evening?: number;
    night?: number;
    sunday?: number;
  };
  
  // Vergoedingen
  travelAllowancePerKm: number;
  holidayAllowancePercentage: number;
  
  // Vakantiedagen
  holidayDaysFormula: string; // "4 * hoursPerWeek"
  extraDays?: number;
  
  // Pensioen
  pensionFund?: string;
  pensionAge: number;
  pensionContribution: {
    employee: number;
    employer: number;
  };
  
  // Bijzondere regelingen
  specialProvisions?: string[];
  
  effectiveDate: Date;
  endDate?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

// User Roles
export interface UserRole {
  id: string;
  uid: string;
  role: 'admin' | 'employee';
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Leave Management
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

// Absence Management
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

  notes: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface AbsenceStatistics {
  id?: string;
  employeeId: string;
  companyId: string;
  period: 'month' | 'quarter' | 'year';
  periodStart: Date;
  periodEnd: Date;

  totalSickDays: number;
  totalSickHours: number;
  absenceFrequency: number;
  averageDuration: number;
  absencePercentage: number;

  longTermAbsence: boolean;
  chronicAbsence: boolean;

  calculatedAt: Date;
}

export type SickLeaveStatus = SickLeave['status'];
export type ReportedVia = SickLeave['reportedVia'];

// Expense Management
export interface Expense {
  id: string;
  userId: string;
  employeeId: string;
  companyId: string;

  type: 'travel' | 'meal' | 'accommodation' | 'parking' | 'phone' | 'office' | 'training' | 'representation' | 'other';

  date: Date;
  amount: number;
  currency: string;
  vatAmount?: number;
  vatPercentage?: number;

  description: string;

  travelDetails?: {
    from: string;
    to: string;
    kilometers?: number;
    vehicleType: 'car' | 'bike' | 'public_transport' | 'taxi';
    licensePlate?: string;

    trainTicket?: boolean;
    busTicket?: boolean;

    parking?: number;
    toll?: number;
  };

  receipts: {
    filename: string;
    data: string;
    uploadedAt: Date;
  }[];

  project?: string;
  costCenter?: string;

  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

  submittedAt?: Date;
  submittedBy?: string;

  approvals: {
    level: number;
    approverName: string;
    approverId: string;
    approvedAt?: Date;
    rejectedAt?: Date;
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

// Payroll Management
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

// ✅ NIEUW: Helper interfaces voor bedrijfs logica
export interface CompanyWithEmployees extends Company {
  employees?: Employee[];
  projectCompanies?: Company[];
}

export interface EmployeeWithCompanies extends Employee {
  primaryEmployer?: Company;
  projectCompaniesData?: Company[];
}

// ✅ NIEUW: Voor timesheet/urenregistratie met bedrijfskeuze
export interface TimeEntryWithCompanyInfo extends TimeEntry {
  workCompany?: Company;
  primaryEmployer?: Company;
}