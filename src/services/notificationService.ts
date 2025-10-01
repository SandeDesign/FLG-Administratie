import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Notification,
  NotificationPreferences,
  EmailTemplate,
  NotificationSchedule,
  NotificationCategory,
  NotificationPriority,
} from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && typeof converted.updatedAt.toDate === 'function') {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.sentAt && typeof converted.sentAt.toDate === 'function') {
    converted.sentAt = converted.sentAt.toDate();
  }
  if (converted.readAt && typeof converted.readAt.toDate === 'function') {
    converted.readAt = converted.readAt.toDate();
  }
  if (converted.archivedAt && typeof converted.archivedAt.toDate === 'function') {
    converted.archivedAt = converted.archivedAt.toDate();
  }
  if (converted.emailSentAt && typeof converted.emailSentAt.toDate === 'function') {
    converted.emailSentAt = converted.emailSentAt.toDate();
  }
  if (converted.metadata?.deadline && typeof converted.metadata.deadline.toDate === 'function') {
    converted.metadata.deadline = converted.metadata.deadline.toDate();
  }

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.updatedAt instanceof Date) {
    converted.updatedAt = Timestamp.fromDate(converted.updatedAt);
  }
  if (converted.sentAt instanceof Date) {
    converted.sentAt = Timestamp.fromDate(converted.sentAt);
  }
  if (converted.readAt instanceof Date) {
    converted.readAt = Timestamp.fromDate(converted.readAt);
  }
  if (converted.archivedAt instanceof Date) {
    converted.archivedAt = Timestamp.fromDate(converted.archivedAt);
  }
  if (converted.emailSentAt instanceof Date) {
    converted.emailSentAt = Timestamp.fromDate(converted.emailSentAt);
  }
  if (converted.metadata?.deadline instanceof Date) {
    converted.metadata.deadline = Timestamp.fromDate(converted.metadata.deadline);
  }

  return converted;
};

export class NotificationService {

  static async createNotification(
    userId: string,
    notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const notificationData = convertToTimestamps({
      ...notification,
      userId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);

    if (notification.channels.includes('in_app')) {
      await this.sendInAppNotification(docRef.id);
    }

    if (notification.channels.includes('email')) {
      await this.sendEmailNotification(docRef.id);
    }

    return docRef.id;
  }

  static async getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      category?: NotificationCategory;
    }
  ): Promise<Notification[]> {
    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (options?.unreadOnly) {
      q = query(q, where('status', 'in', ['pending', 'sent']));
    }

    if (options?.category) {
      q = query(q, where('category', '==', options.category));
    }

    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    } as Notification));
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(docRef, {
      status: 'read',
      readAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'sent'])
    );

    const querySnapshot = await getDocs(q);
    const updatePromises = querySnapshot.docs.map(document =>
      updateDoc(doc(db, 'notifications', document.id), {
        status: 'read',
        readAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      })
    );

    await Promise.all(updatePromises);
  }

  static async archiveNotification(notificationId: string, userId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }

    await updateDoc(docRef, {
      status: 'archived',
      archivedAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('status', 'in', ['pending', 'sent'])
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  }

  private static async sendInAppNotification(notificationId: string): Promise<void> {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, {
      status: 'sent',
      sentAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  private static async sendEmailNotification(notificationId: string): Promise<void> {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error('Notification not found');
      }

      await updateDoc(docRef, {
        emailSent: true,
        emailSentAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        emailSent: false,
        emailError: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: Timestamp.fromDate(new Date()),
      });
    }
  }

  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    const q = query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return this.createDefaultPreferences(userId);
    }

    const doc = querySnapshot.docs; // Get the first document
    return {
      id: doc.id,
      ...convertTimestamps(doc.data()),
    } as NotificationPreferences;
  }

  static async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const q = query(
      collection(db, 'notificationPreferences'),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    const updateData = convertToTimestamps({
      ...preferences,
      updatedAt: new Date(),
    });

    if (querySnapshot.empty) {
      await addDoc(collection(db, 'notificationPreferences'), {
        userId,
        ...updateData,
      });
    } else {
      const docRef = doc(db, 'notificationPreferences', querySnapshot.docs.id); // Use the ID of the existing document
      await updateDoc(docRef, updateData);
    }
  }

  private static async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences: NotificationPreferences = {
      userId,
      email: {
        enabled: true,
        payrollNotifications: true,
        taxReturnNotifications: true,
        contractNotifications: true,
        leaveNotifications: true,
        expenseNotifications: true,
        complianceAlerts: true,
        systemUpdates: false,
      },
      inApp: {
        enabled: true,
        showBadge: true,
        playSound: true,
      },
      push: {
        enabled: false,
      },
      digestFrequency: 'immediate',
      updatedAt: new Date(),
    };

    await addDoc(collection(db, 'notificationPreferences'), convertToTimestamps(defaultPreferences));
    return defaultPreferences;
  }

  static async notifyPayrollApproval(
    userId: string,
    employeeName: string,
    amount: number,
    payrollId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'payroll',
      category: 'payroll_approval',
      priority: 'high',
      title: 'Loonverwerking Gereed',
      message: `Loonverwerking voor ${employeeName} (€${amount.toFixed(2)}) is gereed voor goedkeuring.`,
      actionUrl: `/payroll/${payrollId}`,
      actionLabel: 'Bekijk',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: payrollId,
        entityType: 'payroll',
        amount,
      },
    });
  }

  static async notifyTaxDeadline(
    userId: string,
    year: number,
    period: number,
    deadline: Date
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'tax_return',
      category: 'tax_deadline',
      priority: 'urgent',
      title: 'Belastingaangifte Deadline',
      message: `De deadline voor de loonaangifte ${period}/${year} is ${deadline.toLocaleDateString('nl-NL')}.`,
      actionUrl: '/tax-returns',
      actionLabel: 'Indienen',
      channels: ['in_app', 'email'],
      metadata: {
        deadline,
      },
    });
  }

  static async notifyContractExpiring(
    userId: string,
    employeeName: string,
    endDate: Date,
    employeeId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'contract',
      category: 'contract_expiring',
      priority: 'high',
      title: 'Contract Loopt Af',
      message: `Het contract van ${employeeName} loopt af op ${endDate.toLocaleDateString('nl-NL')}.`,
      actionUrl: `/employees/${employeeId}`,
      actionLabel: 'Bekijk',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: employeeId,
        entityType: 'employee',
        deadline: endDate,
      },
    });
  }

  static async notifyLeaveRequest(
    userId: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    leaveRequestId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'leave',
      category: 'leave_request',
      priority: 'medium',
      title: 'Nieuwe Verlofaanvraag',
      message: `${employeeName} heeft ${leaveType} aangevraagd van ${startDate.toLocaleDateString('nl-NL')} tot ${endDate.toLocaleDateString('nl-NL')}.`,
      actionUrl: `/admin/leave-approvals`,
      actionLabel: 'Beoordelen',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: leaveRequestId,
        entityType: 'leave_request',
      },
    });
  }

  static async notifyExpenseSubmitted(
    userId: string,
    employeeName: string,
    amount: number,
    expenseType: string,
    expenseId: string
  ): Promise<void> {
    await this.createNotification(userId, {
      userId,
      type: 'expense',
      category: 'expense_submitted',
      priority: 'medium',
      title: 'Nieuwe Declaratie',
      message: `${employeeName} heeft een ${expenseType} declaratie ingediend van €${amount.toFixed(2)}.`,
      actionUrl: `/admin/expenses`,
      actionLabel: 'Beoordelen',
      channels: ['in_app', 'email'],
      metadata: {
        entityId: expenseId,
        entityType: 'expense',
        amount,
      },
    });
  }
}