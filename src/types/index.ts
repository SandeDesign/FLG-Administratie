export interface Company {
  id: string;
  name: string;
  kvk: string;
  taxNumber: string;
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
}

export interface Branch {
  id: string;
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
  companyId: string;
  branchId: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    bsn: string;
    dateOfBirth: Date;
    address: {
      street: string;
      city: string;
      zipCode: string;
      country: string;
    };
    contactInfo: {
      email: string;
      phone: string;
    };
    bankAccount: string;
    photoUrl?: string;
  };
  contractInfo: {
    type: 'permanent' | 'temporary' | 'zero-hours' | 'on-call' | 'freelance';
    startDate: Date;
    endDate?: Date;
    hoursPerWeek?: number;
    position: string;
  };
  salaryInfo: {
    salaryScale: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
    hourlyRate?: number;
    monthlySalary?: number;
    allowances: {
      overtime: number;
      irregular: number;
      shift: number;
      weekend: number;
    };
    holidayAllowancePercentage: number;
    travelAllowancePerKm: number;
    pensionContribution: number;
  };
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
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