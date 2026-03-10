import { getUnscheduledTasks } from './firebase';
import { NotificationService } from './notificationService';

/**
 * Bereken de eerstvolgende vrijdag 19:00
 */
export const getNextFridayDeadline = (fromDate: Date = new Date()): Date => {
  const date = new Date(fromDate);
  const day = date.getDay(); // 0=zo, 1=ma, ..., 5=vr, 6=za

  // Bereken dagen tot vrijdag
  let daysUntilFriday = 5 - day;
  if (daysUntilFriday < 0) daysUntilFriday += 7;
  if (daysUntilFriday === 0 && date.getHours() >= 19) {
    daysUntilFriday = 7; // Als het vrijdag na 19:00 is, neem volgende week
  }

  date.setDate(date.getDate() + daysUntilFriday);
  date.setHours(19, 0, 0, 0);
  return date;
};

/**
 * Bepaal het herinnering-niveau op basis van de huidige dag
 * Returns: null (geen herinnering), 'light' (woensdag), 'strong' (donderdag), 'overdue' (vrijdag 19:00+)
 */
export const getReminderLevel = (now: Date = new Date()): 'light' | 'strong' | 'overdue' | null => {
  const day = now.getDay();
  const hour = now.getHours();

  // Vrijdag na 19:00 of weekend
  if ((day === 5 && hour >= 19) || day === 6 || day === 0) {
    return 'overdue';
  }

  // Donderdag
  if (day === 4) {
    return 'strong';
  }

  // Woensdag
  if (day === 3) {
    return 'light';
  }

  return null;
};

/**
 * Haal de localStorage key op voor reminders
 */
const getReminderKey = (userId: string, level: string): string => {
  const today = new Date().toISOString().split('T')[0];
  return `taskScheduleReminder_${userId}_${level}_${today}`;
};

/**
 * Check of een herinnering vandaag al getoond is
 */
export const wasReminderShownToday = (userId: string, level: string): boolean => {
  const key = getReminderKey(userId, level);
  return localStorage.getItem(key) === 'true';
};

/**
 * Markeer herinnering als getoond voor vandaag
 */
export const markReminderShown = (userId: string, level: string): void => {
  const key = getReminderKey(userId, level);
  localStorage.setItem(key, 'true');
};

/**
 * Herinnering berichten per niveau
 */
export const getReminderMessage = (
  level: 'light' | 'strong' | 'overdue',
  unscheduledCount: number
): { title: string; message: string; priority: 'low' | 'medium' | 'high' | 'urgent' } => {
  switch (level) {
    case 'light':
      return {
        title: 'Taken inplannen',
        message: `Je hebt ${unscheduledCount} ${unscheduledCount === 1 ? 'taak' : 'taken'} die nog ingepland ${unscheduledCount === 1 ? 'moet' : 'moeten'} worden deze week. Plan ze in voor vrijdag 19:00.`,
        priority: 'low',
      };
    case 'strong':
      return {
        title: 'Morgen is de deadline!',
        message: `Plan je ${unscheduledCount} openstaande ${unscheduledCount === 1 ? 'taak' : 'taken'} in voor morgen (vrijdag) 19:00. Gebruik je agenda om ze realistisch in te plannen.`,
        priority: 'high',
      };
    case 'overdue':
      return {
        title: 'Deadline verstreken!',
        message: `${unscheduledCount} ${unscheduledCount === 1 ? 'taak is' : 'taken zijn'} niet ingepland voor de vrijdag 19:00 deadline. Neem contact op met je leidinggevende.`,
        priority: 'urgent',
      };
  }
};

/**
 * Check en toon scheduling herinneringen (aan te roepen bij app-load)
 */
export const checkAndShowSchedulingReminders = async (
  userId: string,
  userUid: string,
  companyId?: string
): Promise<{ level: 'light' | 'strong' | 'overdue'; unscheduledCount: number } | null> => {
  try {
    const level = getReminderLevel();
    if (!level) return null;

    // Check of herinnering al getoond is vandaag
    if (wasReminderShownToday(userUid, level)) return null;

    // Haal niet-ingeplande taken op
    const unscheduledTasks = await getUnscheduledTasks(userUid, companyId);
    if (unscheduledTasks.length === 0) return null;

    // Markeer als getoond
    markReminderShown(userUid, level);

    // Maak in-app notificatie aan
    const { title, message, priority } = getReminderMessage(level, unscheduledTasks.length);

    try {
      const notificationService = NotificationService.getInstance();
      await notificationService.createNotification(userId, {
        type: 'task',
        category: level === 'overdue' ? 'task_schedule_overdue' : 'task_schedule_reminder',
        priority,
        title,
        message,
        actionUrl: '/employee-dashboard/agenda',
        actionLabel: 'Naar agenda',
        channels: ['in_app'],
        metadata: {
          unscheduledCount: unscheduledTasks.length,
          reminderLevel: level,
        },
      });
    } catch {
      // Notificatie service mag niet crashen
    }

    return { level, unscheduledCount: unscheduledTasks.length };
  } catch (error) {
    console.error('Error checking scheduling reminders:', error);
    return null;
  }
};
