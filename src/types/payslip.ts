export interface Payslip {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  payrollPeriodId: string;
  payrollCalculationId: string;
  periodStartDate: Date;
  periodEndDate: Date;
  paymentDate: Date;
  pdfUrl: string;
  pdfStoragePath: string;
  generatedAt: Date;
  generatedBy: string;
  emailedAt?: Date;
  downloadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayslipData {
  company: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    kvkNumber: string;
    taxNumber: string;
    logo?: string;
  };
  employee: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    bsn: string;
    taxNumber: string;
    employeeNumber: string;
    jobTitle: string;
  };
  period: {
    startDate: Date;
    endDate: Date;
    paymentDate: Date;
    payrollNumber: string;
  };
  earnings: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    ytdAmount: number;
  }>;
  deductions: Array<{
    description: string;
    amount: number;
    ytdAmount: number;
  }>;
  taxes: Array<{
    description: string;
    amount: number;
    ytdAmount: number;
  }>;
  summary: {
    grossPay: number;
    totalDeductions: number;
    totalTaxes: number;
    netPay: number;
    ytdGross: number;
    ytdDeductions: number;
    ytdTaxes: number;
    ytdNet: number;
  };
  leave: {
    vacationDaysAccrued: number;
    vacationDaysUsed: number;
    vacationDaysBalance: number;
  };
  pension: {
    employeeContribution: number;
    employerContribution: number;
    ytdEmployeeContribution: number;
    ytdEmployerContribution: number;
  };
}
