export interface Notification {
  id: string;
  userId: string;
  employeeId?: string;

  type: 'payroll' | 'tax_return' | 'contract' | 'leave' | 'expense' | 'compliance' | 'system' | 'task';

  category:
    | 'payroll_approval'
    | 'payroll_completed'
    | 'tax_submission'
    | 'tax_deadline'
    | 'contract_expiring'
    | 'leave_request'
    | 'leave_approved'
    | 'expense_submitted'
    | 'expense_approved'
    | 'compliance_alert'
    | 'system_update'
    | 'task_assigned'
    | 'task_schedule_reminder'
    | 'task_schedule_overdue';

  priority: 'low' | 'medium' | 'high' | 'urgent';

  title: string;
  message: string;

  actionUrl?: string;
  actionLabel?: string;

  metadata?: {
    entityId?: string;
    entityType?: string;
    companyId?: string;
    amount?: number;
    deadline?: Date;
    [key: string]: any;
  };

  channels: ('in_app' | 'email' | 'push')[];

  status: 'pending' | 'sent' | 'read' | 'archived' | 'failed';

  sentAt?: Date;
  readAt?: Date;
  archivedAt?: Date;

  emailSent?: boolean;
  emailSentAt?: Date;
  emailError?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;

  email: {
    enabled: boolean;
    payrollNotifications: boolean;
    taxReturnNotifications: boolean;
    contractNotifications: boolean;
    leaveNotifications: boolean;
    expenseNotifications: boolean;
    complianceAlerts: boolean;
    systemUpdates: boolean;
    taskNotifications: boolean;
  };

  inApp: {
    enabled: boolean;
    showBadge: boolean;
    playSound: boolean;
  };

  push: {
    enabled: boolean;
    token?: string;
  };

  digestFrequency: 'immediate' | 'daily' | 'weekly' | 'never';

  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };

  updatedAt: Date;
}

export interface EmailTemplate {
  id: string;
  companyId: string;

  name: string;
  category: Notification['category'];

  subject: string;
  body: string;

  variables: {
    name: string;
    description: string;
    example: string;
  }[];

  styling?: {
    headerColor?: string;
    logoUrl?: string;
    footerText?: string;
  };

  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationSchedule {
  id: string;
  userId: string;
  companyId: string;

  type: 'recurring' | 'one_time';

  eventType: 'contract_expiry' | 'tax_deadline' | 'payroll_reminder' | 'compliance_check';

  schedule: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    time: string;
  };

  notification: {
    title: string;
    message: string;
    priority: Notification['priority'];
  };

  daysBeforeEvent?: number;

  active: boolean;
  lastRun?: Date;
  nextRun: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type NotificationType = Notification['type'];
export type NotificationCategory = Notification['category'];
export type NotificationPriority = Notification['priority'];
export type NotificationStatus = Notification['status'];
export type NotificationChannel = 'in_app' | 'email' | 'push';
