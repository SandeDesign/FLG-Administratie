// Netlify Scheduled Function — draait elke 15 minuten.
//
// Scant 'businessTasks' voor taken waarvan de dueDate tussen NU en NU+1u15min
// ligt, die nog niet afgerond/cancelled zijn, en waar reminderSentAt nog
// niet gezet is. Voor elk zulk item:
//   1. Stuur push naar alle assignees (via resolveToUserUids logica)
//   2. Markeer reminderSentAt = serverTimestamp zodat we niet nog een
//      keer sturen voor deze taak.
//
// Window is 1u15min zodat we bij een gemiste scheduled run (iets vertraagd
// door Netlify infrastructure) de notificatie alsnog binnen het bedoelde
// 1-uur-voor-deadline venster versturen.

import type { Config } from '@netlify/functions';
import { getDb } from './_lib/firebaseAdmin';
import { sendPushToUsers } from './_lib/push';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const WINDOW_MS = 75 * 60 * 1000; // 1u15min

/**
 * Resolve mix van employee IDs en user UIDs naar user UIDs (server-side variant).
 */
const resolveToUserUids = async (ids: string[]): Promise<string[]> => {
  if (!ids || ids.length === 0) return [];
  const db = getDb();
  const cleaned = Array.from(new Set(ids.filter(Boolean)));
  const result = new Set<string>();

  for (let i = 0; i < cleaned.length; i += 30) {
    const chunk = cleaned.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where('employeeId', 'in', chunk)
      .get();

    const matched = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data();
      const uid = (data.uid as string) || '';
      const empId = data.employeeId as string | undefined;
      if (uid) result.add(uid);
      if (empId) matched.add(empId);
    });
    chunk.forEach((id) => {
      if (!matched.has(id)) result.add(id);
    });
  }
  return Array.from(result);
};

const formatTime = (d: Date): string =>
  new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }).format(d);

export default async (_req: Request) => {
  const db = getDb();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_MS);

  console.log(
    `[scheduled-task-reminders] Scan tussen ${now.toISOString()} en ${windowEnd.toISOString()}`
  );

  // Firestore-query: we kunnen niet op 3 velden tegelijk filteren op
  // range+equality zonder composite index, dus we halen op dueDate
  // range + status en filteren in-memory op reminderSentAt == null.
  const snap = await db
    .collection('businessTasks')
    .where('status', 'in', ['pending', 'in_progress'])
    .where('dueDate', '>=', Timestamp.fromDate(now))
    .where('dueDate', '<=', Timestamp.fromDate(windowEnd))
    .get();

  const tasks = snap.docs.filter((d) => {
    const data = d.data();
    return !data.reminderSentAt;
  });

  console.log(`[scheduled-task-reminders] ${tasks.length} taken in venster zonder reminder.`);

  let pushedCount = 0;
  for (const taskDoc of tasks) {
    const task = taskDoc.data();
    const assignedTo = (task.assignedTo as string[] | undefined) || [];
    if (assignedTo.length === 0) continue;

    const uids = await resolveToUserUids(assignedTo);
    if (uids.length === 0) continue;

    const dueDate: Date = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    const title = `Deadline over 1 uur: ${task.title || 'Taak'}`;
    const body = `Deadline om ${formatTime(dueDate)}${
      task.description ? ` — ${String(task.description).substring(0, 60)}` : ''
    }`;

    try {
      await sendPushToUsers(uids, {
        title,
        body,
        url: '/tasks',
        taskId: taskDoc.id,
        category: 'task_deadline_reminder',
        tag: `task-deadline-${taskDoc.id}`,
      });
      // Markeer reminder als verzonden
      await taskDoc.ref.update({
        reminderSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      pushedCount++;
    } catch (err) {
      console.error(
        `[scheduled-task-reminders] push mislukt voor task ${taskDoc.id}:`,
        err
      );
    }
  }

  console.log(`[scheduled-task-reminders] ${pushedCount} reminders gepusht.`);
  return new Response(
    JSON.stringify({ checked: tasks.length, pushed: pushedCount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

export const config: Config = {
  schedule: '*/15 * * * *',
};
