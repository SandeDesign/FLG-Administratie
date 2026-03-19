export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';

export interface WorkActivity {
  hours: number;
  description: string;
  clientId?: string;
  projectCode?: string;
  isITKnechtImport?: boolean;
  internalProjectId?: string;
  internalProjectName?: string;
}

export interface TimesheetEntry {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  branchId?: string;
  date: Date;
  regularHours: number;
  overtimeHours: number;
  eveningHours: number;
  nightHours: number;
  weekendHours: number;
  travelKilometers: number;
  projectId?: string;
  costCenter?: string;
  notes?: string;
  workActivities?: WorkActivity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyTimesheet {
  id?: string;
  userId: string;
  employeeId: string;
  companyId: string;
  branchId?: string;
  weekNumber: number;
  year: number;
  entries: TimesheetEntry[];
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalEveningHours: number;
  totalNightHours: number;
  totalWeekendHours: number;
  totalTravelKilometers: number;
  status: TimesheetStatus;
  submittedAt?: Date;
  submittedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimesheetApproval {
  id: string;
  timesheetId: string;
  approverName: string;
  approverId: string;
  action: 'approved' | 'rejected' | 'modification_requested';
  comment?: string;
  timestamp: Date;
}
