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

export interface PayrollCalculation {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  payrollPeriodId: string;
  periodStartDate: Date;
  periodEndDate: Date;

  regularHours: number;
  regularRate: number;
  regularPay: number;

  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;

  eveningHours: number;
  eveningRate: number;
  eveningPay: number;

  nightHours: number;
  nightRate: number;
  nightPay: number;

  weekendHours: number;
  weekendRate: number;
  weekendPay: number;

  holidayHours: number;
  holidayRate: number;
  holidayPay: number;

  travelKilometers: number;
  travelRate: number;
  travelAllowance: number;

  otherEarnings: PayrollEarning[];

  grossPay: number;

  taxes: PayrollTaxes;

  deductions: PayrollDeduction[];

  netPay: number;

  vacationAccrual: number;
  vacationPay: number;

  ytdGross: number;
  ytdNet: number;
  ytdTax: number;

  calculatedAt: Date;
  calculatedBy: string;
  status: 'draft' | 'finalized';

  createdAt: Date;
  updatedAt: Date;
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
