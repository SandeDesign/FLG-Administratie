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
