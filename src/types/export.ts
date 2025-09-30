export type ExportType =
  | 'timesheet_csv'
  | 'payroll_excel'
  | 'payslips_pdf'
  | 'accounting_xml'
  | 'sepa_payment'
  | 'pension_export'
  | 'tax_return_xml'
  | 'audit_log'
  | 'full_backup';

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id?: string;
  userId: string;
  companyId: string;
  exportType: ExportType;
  status: ExportStatus;

  filters: {
    startDate?: Date;
    endDate?: Date;
    employeeIds?: string[];
    branchIds?: string[];
    payrollPeriodId?: string;
  };

  fileName: string;
  fileUrl?: string;
  fileStoragePath?: string;
  fileSize?: number;

  recordCount: number;

  errorMessage?: string;

  requestedAt: Date;
  requestedBy: string;
  completedAt?: Date;
  downloadedAt?: Date;

  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface SEPAPayment {
  messageId: string;
  creationDate: Date;
  companyName: string;
  companyIBAN: string;
  companyBIC: string;
  totalAmount: number;
  paymentCount: number;
  executionDate: Date;
  payments: Array<{
    employeeName: string;
    employeeIBAN: string;
    employeeBIC?: string;
    amount: number;
    description: string;
    endToEndId: string;
  }>;
}

export interface AccountingExport {
  journalEntries: Array<{
    date: Date;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    costCenter?: string;
    project?: string;
    reference: string;
  }>;
  totals: {
    totalDebits: number;
    totalCredits: number;
  };
}

export interface PensionExport {
  fundName: string;
  companyNumber: string;
  period: {
    year: number;
    quarter: number;
  };
  employees: Array<{
    employeeNumber: string;
    bsn: string;
    name: string;
    dateOfBirth: Date;
    pensionableSalary: number;
    employeeContribution: number;
    employerContribution: number;
    startDate?: Date;
    endDate?: Date;
    mutationType: 'new' | 'mutation' | 'termination';
  }>;
  totals: {
    employeeContributions: number;
    employerContributions: number;
    totalContributions: number;
  };
}
