export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';

/**
 * Verplichte dag-status om gaploze weken af te dwingen. Werknemer moet
 * voor elke werkdag aangeven wat hij deed — geen stille gaten meer.
 *
 *   worked   — gewerkt (uren in regularHours/etc.)
 *   holiday  — verlof (vereist goedgekeurd leaveRequest)
 *   sick     — ziek (vereist sickLeave record)
 *   unpaid   — onbetaald afwezig
 *   meeting  — overleg / training / bedrijfs-dag
 *   weekend  — weekend/niet-werkdag (auto voor za/zo)
 *   holiday_public — nationale feestdag (auto)
 */
export type DayStatus = 'worked' | 'holiday' | 'sick' | 'unpaid' | 'meeting' | 'weekend' | 'holiday_public';

export interface WorkActivity {
  hours: number;
  description: string;
  clientId?: string;
  projectCode?: string;
  isITKnechtImport?: boolean;
  internalProjectId?: string;
  internalProjectName?: string;
  taskId?: string;
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
  // ─── Gap-sluitende compliance ─────────────────────────────────────
  /** Verplichte status per werkdag. Optioneel voor backwards-compat op
   *  oude entries; nieuwe entries zetten dit altijd. */
  dayStatus?: DayStatus;
  /** Optionele vrije tekst bij niet-gewerkt (reden afwezigheid). */
  statusReason?: string;
  /** Toelichting bij GEWERKT maar minder dan 8u: welke effort heb je
   *  toch geleverd (kantoor gebeld, klanten geappt, administratie, etc.)? */
  effortNote?: string;
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
  /** Moment waarop de week definitief op slot ging (= bij indienen). */
  lockedAt?: Date;
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
