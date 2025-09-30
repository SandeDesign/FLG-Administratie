import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WeeklyTimesheet, TimesheetEntry, TimesheetStatus } from '../types/timesheet';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.date && typeof converted.date.toDate === 'function') {
    converted.date = converted.date.toDate();
  }
  if (converted.submittedAt && typeof converted.submittedAt.toDate === 'function') {
    converted.submittedAt = converted.submittedAt.toDate();
  }
  if (converted.approvedAt && typeof converted.approvedAt.toDate === 'function') {
    converted.approvedAt = converted.approvedAt.toDate();
  }
  if (converted.rejectedAt && typeof converted.rejectedAt.toDate === 'function') {
    converted.rejectedAt = converted.rejectedAt.toDate();
  }
  if (converted.processedAt && typeof converted.processedAt.toDate === 'function') {
    converted.processedAt = converted.processedAt.toDate();
  }
  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && typeof converted.updatedAt.toDate === 'function') {
    converted.updatedAt = converted.updatedAt.toDate();
  }

  if (converted.entries && Array.isArray(converted.entries)) {
    converted.entries = converted.entries.map((entry: any) => convertTimestamps(entry));
  }

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.date instanceof Date) {
    converted.date = Timestamp.fromDate(converted.date);
  }
  if (converted.submittedAt instanceof Date) {
    converted.submittedAt = Timestamp.fromDate(converted.submittedAt);
  }
  if (converted.approvedAt instanceof Date) {
    converted.approvedAt = Timestamp.fromDate(converted.approvedAt);
  }
  if (converted.rejectedAt instanceof Date) {
    converted.rejectedAt = Timestamp.fromDate(converted.rejectedAt);
  }
  if (converted.processedAt instanceof Date) {
    converted.processedAt = Timestamp.fromDate(converted.processedAt);
  }
  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.updatedAt instanceof Date) {
    converted.updatedAt = Timestamp.fromDate(converted.updatedAt);
  }

  if (converted.entries && Array.isArray(converted.entries)) {
    converted.entries = converted.entries.map((entry: any) => convertToTimestamps(entry));
  }

  return converted;
};

export const getWeeklyTimesheets = async (
  adminUserId: string,
  employeeId?: string,
  year?: number,
  weekNumber?: number
): Promise<WeeklyTimesheet[]> => {
  let q = query(
    collection(db, 'weeklyTimesheets'),
    where('userId', '==', adminUserId),
    orderBy('year', 'desc'),
    orderBy('weekNumber', 'desc')
  );

  if (employeeId) {
    q = query(
      collection(db, 'weeklyTimesheets'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('year', 'desc'),
      orderBy('weekNumber', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  let timesheets = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as WeeklyTimesheet));

  if (year) {
    timesheets = timesheets.filter(t => t.year === year);
  }

  if (weekNumber) {
    timesheets = timesheets.filter(t => t.weekNumber === weekNumber);
  }

  return timesheets;
};

export const getWeeklyTimesheet = async (id: string, userId: string): Promise<WeeklyTimesheet | null> => {
  const docRef = doc(db, 'weeklyTimesheets', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }

  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as WeeklyTimesheet;
};

export const createWeeklyTimesheet = async (
  userId: string,
  timesheet: Omit<WeeklyTimesheet, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const timesheetData = convertToTimestamps({
    ...timesheet,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'weeklyTimesheets'), timesheetData);
  return docRef.id;
};

export const updateWeeklyTimesheet = async (
  id: string,
  userId: string,
  updates: Partial<WeeklyTimesheet>
): Promise<void> => {
  const docRef = doc(db, 'weeklyTimesheets', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  await updateDoc(docRef, updateData);
};

export const submitWeeklyTimesheet = async (
  id: string,
  userId: string,
  submittedBy: string
): Promise<void> => {
  await updateWeeklyTimesheet(id, userId, {
    status: 'submitted',
    submittedAt: new Date(),
    submittedBy
  });
};

export const approveWeeklyTimesheet = async (
  id: string,
  userId: string,
  approvedBy: string
): Promise<void> => {
  await updateWeeklyTimesheet(id, userId, {
    status: 'approved',
    approvedAt: new Date(),
    approvedBy
  });
};

export const rejectWeeklyTimesheet = async (
  id: string,
  userId: string,
  rejectedBy: string,
  rejectionReason: string
): Promise<void> => {
  await updateWeeklyTimesheet(id, userId, {
    status: 'rejected',
    rejectedAt: new Date(),
    rejectedBy,
    rejectionReason
  });
};

export const getPendingTimesheets = async (adminUserId: string, companyId: string): Promise<WeeklyTimesheet[]> => {
  const q = query(
    collection(db, 'weeklyTimesheets'),
    where('userId', '==', adminUserId),
    where('companyId', '==', companyId),
    where('status', '==', 'submitted'),
    orderBy('submittedAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as WeeklyTimesheet));
};

export const calculateWeekTotals = (entries: TimesheetEntry[]) => {
  return entries.reduce(
    (totals, entry) => ({
      regularHours: totals.regularHours + entry.regularHours,
      overtimeHours: totals.overtimeHours + entry.overtimeHours,
      eveningHours: totals.eveningHours + entry.eveningHours,
      nightHours: totals.nightHours + entry.nightHours,
      weekendHours: totals.weekendHours + entry.weekendHours,
      travelKilometers: totals.travelKilometers + entry.travelKilometers
    }),
    {
      regularHours: 0,
      overtimeHours: 0,
      eveningHours: 0,
      nightHours: 0,
      weekendHours: 0,
      travelKilometers: 0
    }
  );
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getWeekDates = (year: number, weekNumber: number): Date[] => {
  const jan4 = new Date(year, 0, 4);
  const firstMonday = new Date(jan4.getTime() - (jan4.getDay() - 1) * 86400000);
  const weekStart = new Date(firstMonday.getTime() + (weekNumber - 1) * 7 * 86400000);

  return Array.from({ length: 7 }, (_, i) =>
    new Date(weekStart.getTime() + i * 86400000)
  );
};
