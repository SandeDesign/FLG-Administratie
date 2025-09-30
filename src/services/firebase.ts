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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Company, Branch, Employee, TimeEntry, UserRole, LeaveRequest, LeaveBalance, SickLeave, AbsenceStatistics, Expense } from '../types';
import { generatePoortwachterMilestones, shouldActivatePoortwachter } from '../utils/poortwachterTracking';

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any) => {
  const converted = { ...data };
  
  // Convert top-level timestamps
  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt && typeof converted.updatedAt.toDate === 'function') {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.date && typeof converted.date.toDate === 'function') {
    converted.date = converted.date.toDate();
  }
  
  // Convert leave request specific dates
  if (converted.startDate && typeof converted.startDate.toDate === 'function') {
    converted.startDate = converted.startDate.toDate();
  }
  if (converted.endDate && typeof converted.endDate.toDate === 'function') {
    converted.endDate = converted.endDate.toDate();
  }
  if (converted.approvedAt && typeof converted.approvedAt.toDate === 'function') {
    converted.approvedAt = converted.approvedAt.toDate();
  }
  if (converted.reportedAt && typeof converted.reportedAt.toDate === 'function') {
    converted.reportedAt = converted.reportedAt.toDate();
  }
  if (converted.actualReturnDate && typeof converted.actualReturnDate.toDate === 'function') {
    converted.actualReturnDate = converted.actualReturnDate.toDate();
  }
  
  // Convert nested timestamps in personalInfo
  if (converted.personalInfo?.dateOfBirth && typeof converted.personalInfo.dateOfBirth.toDate === 'function') {
    converted.personalInfo.dateOfBirth = converted.personalInfo.dateOfBirth.toDate();
  }
  
  // Convert nested timestamps in contractInfo
  if (converted.contractInfo?.startDate && typeof converted.contractInfo.startDate.toDate === 'function') {
    converted.contractInfo.startDate = converted.contractInfo.startDate.toDate();
  }
  if (converted.contractInfo?.endDate && typeof converted.contractInfo.endDate.toDate === 'function') {
    converted.contractInfo.endDate = converted.contractInfo.endDate.toDate();
  }
  if (converted.contractInfo?.noticeDate && typeof converted.contractInfo.noticeDate.toDate === 'function') {
    converted.contractInfo.noticeDate = converted.contractInfo.noticeDate.toDate();
  }
  
  // Convert nested timestamps in leaveInfo
  if (converted.leaveInfo?.holidayDays?.expiryDate && typeof converted.leaveInfo.holidayDays.expiryDate.toDate === 'function') {
    converted.leaveInfo.holidayDays.expiryDate = converted.leaveInfo.holidayDays.expiryDate.toDate();
  }
  
  // Convert accountCreatedAt if present
  if (converted.accountCreatedAt && typeof converted.accountCreatedAt.toDate === 'function') {
    converted.accountCreatedAt = converted.accountCreatedAt.toDate();
  }
  
  return converted;
};

// Helper function to convert Date objects to Firestore timestamps
const convertToTimestamps = (data: any) => {
  const converted = { ...data };
  
  // Convert Date objects to Timestamps
  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.updatedAt instanceof Date) {
    converted.updatedAt = Timestamp.fromDate(converted.updatedAt);
  }
  if (converted.date instanceof Date) {
    converted.date = Timestamp.fromDate(converted.date);
  }
  
  // Convert leave request dates
  if (converted.startDate instanceof Date) {
    converted.startDate = Timestamp.fromDate(converted.startDate);
  }
  if (converted.endDate instanceof Date) {
    converted.endDate = Timestamp.fromDate(converted.endDate);
  }
  if (converted.approvedAt instanceof Date) {
    converted.approvedAt = Timestamp.fromDate(converted.approvedAt);
  }
  if (converted.reportedAt instanceof Date) {
    converted.reportedAt = Timestamp.fromDate(converted.reportedAt);
  }
  if (converted.actualReturnDate instanceof Date) {
    converted.actualReturnDate = Timestamp.fromDate(converted.actualReturnDate);
  }
  
  // Convert nested dates in personalInfo
  if (converted.personalInfo?.dateOfBirth instanceof Date) {
    converted.personalInfo.dateOfBirth = Timestamp.fromDate(converted.personalInfo.dateOfBirth);
  }
  
  // Convert nested dates in contractInfo
  if (converted.contractInfo?.startDate instanceof Date) {
    converted.contractInfo.startDate = Timestamp.fromDate(converted.contractInfo.startDate);
  }
  if (converted.contractInfo?.endDate instanceof Date) {
    converted.contractInfo.endDate = Timestamp.fromDate(converted.contractInfo.endDate);
  }
  if (converted.contractInfo?.noticeDate instanceof Date) {
    converted.contractInfo.noticeDate = Timestamp.fromDate(converted.contractInfo.noticeDate);
  }
  
  // Convert nested dates in leaveInfo
  if (converted.leaveInfo?.holidayDays?.expiryDate instanceof Date) {
    converted.leaveInfo.holidayDays.expiryDate = Timestamp.fromDate(converted.leaveInfo.holidayDays.expiryDate);
  }
  
  // Convert accountCreatedAt if present
  if (converted.accountCreatedAt instanceof Date) {
    converted.accountCreatedAt = Timestamp.fromDate(converted.accountCreatedAt);
  }
  
  return converted;
};

// Companies
export const getCompanies = async (userId: string): Promise<Company[]> => {
  const q = query(
    collection(db, 'companies'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Company));
};

export const getCompany = async (id: string, userId: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as Company;
};

export const createCompany = async (userId: string, company: Omit<Company, 'id' | 'userId'>): Promise<string> => {
  const companyData = convertToTimestamps({
    ...company,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const docRef = await addDoc(collection(db, 'companies'), companyData);
  return docRef.id;
};

export const updateCompany = async (id: string, userId: string, updates: Partial<Company>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'companies', id);
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

export const deleteCompany = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Branches
export const getBranches = async (userId: string, companyId?: string): Promise<Branch[]> => {
  let q;
  if (companyId) {
    q = query(
      collection(db, 'branches'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'branches'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Branch));
};

export const createBranch = async (userId: string, branch: Omit<Branch, 'id' | 'userId'>): Promise<string> => {
  const branchData = convertToTimestamps({
    ...branch,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const docRef = await addDoc(collection(db, 'branches'), branchData);
  return docRef.id;
};

export const updateBranch = async (id: string, userId: string, updates: Partial<Branch>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'branches', id);
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

export const deleteBranch = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'branches', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Employees
export const getEmployees = async (userId: string, companyId?: string, branchId?: string): Promise<Employee[]> => {
  let q;
  
  if (companyId && branchId) {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      where('branchId', '==', branchId),
      orderBy('createdAt', 'desc')
    );
  } else if (companyId) {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Employee));
};

export const getEmployee = async (id: string, userId: string): Promise<Employee | null> => {
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as Employee;
};

export const createEmployee = async (userId: string, employee: Omit<Employee, 'id' | 'userId'>): Promise<string> => {
  const employeeData = convertToTimestamps({
    ...employee,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const docRef = await addDoc(collection(db, 'employees'), employeeData);
  return docRef.id;
};

export const updateEmployee = async (id: string, userId: string, updates: Partial<Employee>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'employees', id);
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

export const deleteEmployee = async (id: string, userId: string): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Employee not found');
  }
  
  const employeeData = docSnap.data();
  if (!employeeData || !employeeData.userId || typeof employeeData.userId !== 'string' || employeeData.userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  await deleteDoc(docRef);
};

// Get employee by ID without userId check (for employee self-access)
export const getEmployeeById = async (employeeId: string): Promise<Employee | null> => {
  const docRef = doc(db, 'employees', employeeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as Employee;
};

// Time Entries
export const getTimeEntries = async (userId: string, employeeId?: string, dateRange?: { start: Date; end: Date }): Promise<TimeEntry[]> => {
  let q;
  
  if (employeeId) {
    q = query(
      collection(db, 'timeEntries'),
      where('userId', '==', userId),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(db, 'timeEntries'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );
  }
  
  const querySnapshot = await getDocs(q);
  let entries = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as TimeEntry));
  
  // Filter by date range if provided
  if (dateRange) {
    entries = entries.filter(entry => 
      entry.date >= dateRange.start && entry.date <= dateRange.end
    );
  }
  
  return entries;
};

export const createTimeEntry = async (userId: string, timeEntry: Omit<TimeEntry, 'id' | 'userId'>): Promise<string> => {
  const entryData = convertToTimestamps({
    ...timeEntry,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const docRef = await addDoc(collection(db, 'timeEntries'), entryData);
  return docRef.id;
};

export const updateTimeEntry = async (id: string, userId: string, updates: Partial<TimeEntry>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'timeEntries', id);
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

// User Roles
export const createUserRole = async (uid: string, role: 'admin' | 'employee', employeeId?: string): Promise<void> => {
  const roleData = convertToTimestamps({
    uid,
    role,
    employeeId: employeeId || null,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  await addDoc(collection(db, 'users'), roleData);
};

export const getUserRole = async (uid: string): Promise<UserRole | null> => {
  const q = query(
    collection(db, 'users'),
    where('uid', '==', uid)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  const doc = querySnapshot.docs;
  return {
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as UserRole;
};

// Employee Account Management
export const createEmployeeAuthAccount = async (
  employeeId: string, 
  userId: string, 
  email: string, 
  password: string
): Promise<string> => {
  try {
    // First verify ownership of the employee record
    const employeeRef = doc(db, 'employees', employeeId);
    const employeeSnap = await getDoc(employeeRef);
    
    if (!employeeSnap.exists() || employeeSnap.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUserId = userCredential.user.uid;
    
    // Update employee record to mark as having account
    const updateData = convertToTimestamps({
      hasAccount: true,
      accountCreatedAt: new Date(),
      updatedAt: new Date()
    });
    
    await updateDoc(employeeRef, updateData);
    
    // Create user role for the new employee
    await createUserRole(newUserId, 'employee', employeeId);
    
    return newUserId;
  } catch (error) {
    console.error('Error creating employee account:', error);
    throw error;
  }
};

// Generate secure password
export const generateSecurePassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Leave Requests
export const getLeaveRequests = async (adminUserId: string, employeeId?: string): Promise<LeaveRequest[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', adminUserId),
      orderBy('createdAt', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const requests = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as LeaveRequest));
  
  return requests;
};

export const createLeaveRequest = async (adminUserId: string, request: Omit<LeaveRequest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  const requestData = convertToTimestamps({
    ...request,
    userId: adminUserId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'leaveRequests'), requestData);
  return docRef.id;
};

export const updateLeaveRequest = async (id: string, userId: string, updates: Partial<LeaveRequest>): Promise<void> => {
  const docRef = doc(db, 'leaveRequests', id);
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

export const approveLeaveRequest = async (id: string, userId: string, approvedBy: string): Promise<void> => {
  await updateLeaveRequest(id, userId, {
    status: 'approved',
    approvedBy,
    approvedAt: new Date()
  });
};

export const rejectLeaveRequest = async (id: string, userId: string, approvedBy: string, reason: string): Promise<void> => {
  await updateLeaveRequest(id, userId, {
    status: 'rejected',
    approvedBy,
    rejectedReason: reason
  });
};

export const getPendingLeaveApprovals = async (companyId: string, userId: string): Promise<LeaveRequest[]> => {
  const q = query(
    collection(db, 'leaveRequests'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as LeaveRequest));
};

// Leave Balance
export const getLeaveBalance = async (employeeId: string, userId: string, year: number): Promise<LeaveBalance | null> => {
  const q = query(
    collection(db, 'leaveBalances'),
    where('employeeId', '==', employeeId),
    where('year', '==', year)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const docData = querySnapshot.docs;
  return {
    id: docData.id,
    ...convertTimestamps(docData.data())
  } as LeaveBalance;
};

export const updateLeaveBalance = async (employeeId: string, userId: string, year: number, balance: Partial<LeaveBalance>): Promise<void> => {
  const q = query(
    collection(db, 'leaveBalances'),
    where('employeeId', '==', employeeId),
    where('year', '==', year)
  );

  const querySnapshot = await getDocs(q);
  const balanceData = convertToTimestamps({
    ...balance,
    employeeId,
    year,
    updatedAt: new Date()
  });

  if (querySnapshot.empty) {
    await addDoc(collection(db, 'leaveBalances'), balanceData);
  } else {
    const docRef = doc(db, 'leaveBalances', querySnapshot.docs.id);
    await updateDoc(docRef, balanceData);
  }
};

// Sick Leave
export const getSickLeaveRecords = async (adminUserId: string, employeeId?: string): Promise<SickLeave[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'sickLeave'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('startDate', 'desc')
    );
  } else {
    q = query(
      collection(db, 'sickLeave'),
      where('userId', '==', adminUserId),
      orderBy('startDate', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const records = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as SickLeave));
  
  return records;
};

export const createSickLeave = async (adminUserId: string, sickLeave: Omit<SickLeave, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  const shouldActivate = shouldActivatePoortwachter(sickLeave.startDate);
  const milestones = shouldActivate ? generatePoortwachtersMilestones(sickLeave.startDate) : null;

  const sickLeaveData = convertToTimestamps({
    ...sickLeave,
    userId: adminUserId,
    poortwachterActive: shouldActivate,
    poortwachterMilestones: milestones,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'sickLeave'), sickLeaveData);
  return docRef.id;
};

export const updateSickLeave = async (id: string, userId: string, updates: Partial<SickLeave>): Promise<void> => {
  const docRef = doc(db, 'sickLeave', id);
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

export const getActiveSickLeave = async (companyId: string, userId: string): Promise<SickLeave[]> => {
  const q = query(
    collection(db, 'sickLeave'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', 'in', ['active', 'partially_recovered']),
    orderBy('startDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as SickLeave));
};

// Absence Statistics
export const getAbsenceStatistics = async (employeeId: string, userId: string, year: number): Promise<AbsenceStatistics | null> => {
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  const q = query(
    collection(db, 'absenceStatistics'),
    where('employeeId', '==', employeeId),
    where('period', '==', 'year'),
    where('periodStart', '>=', Timestamp.fromDate(periodStart)),
    where('periodEnd', '<=', Timestamp.fromDate(periodEnd))
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const docData = querySnapshot.docs;
  return {
    id: docData.id,
    ...convertTimestamps(docData.data())
  } as AbsenceStatistics;
};

export const calculateAbsenceStats = async (employeeId: string, companyId: string, userId: string, year: number): Promise<void> => {
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  const q = query(
    collection(db, 'sickLeave'),
    where('userId', '==', userId),
    where('employeeId', '==', employeeId),
    where('startDate', '>=', Timestamp.fromDate(periodStart)),
    where('startDate', '<=', Timestamp.fromDate(periodEnd))
  );

  const querySnapshot = await getDocs(q);
  const sickLeaves = querySnapshot.docs.map(doc => convertTimestamps(doc.data()) as SickLeave);

  const totalSickDays = sickLeaves.reduce((sum, leave) => {
    const start = leave.startDate;
    const end = leave.endDate || new Date();
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);

  const absenceFrequency = sickLeaves.length;
  const averageDuration = absenceFrequency > 0 ? totalSickDays / absenceFrequency : 0;

  const workingDays = 260; // Approximate working days in a year
  const absencePercentage = (totalSickDays / workingDays) * 100;

  const longTermAbsence = sickLeaves.some(leave => {
    const start = leave.startDate;
    const end = leave.endDate || new Date();
    const weeks = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return weeks > 6;
  });

  const chronicAbsence = absenceFrequency >= 3;

  const statsData = convertToTimestamps({
    employeeId,
    companyId,
    period: 'year',
    periodStart,
    periodEnd,
    totalSickDays,
    totalSickHours: totalSickDays * 8, // Assuming 8 hours per day
    absenceFrequency,
    averageDuration,
    absencePercentage,
    longTermAbsence,
    chronicAbsence,
    calculatedAt: new Date()
  });

  const existingQuery = query(
    collection(db, 'absenceStatistics'),
    where('employeeId', '==', employeeId),
    where('period', '==', 'year'),
    where('periodStart', '>=', Timestamp.fromDate(periodStart)),
    where('periodEnd', '<=', Timestamp.fromDate(periodEnd))
  );

  const existingSnapshot = await getDocs(existingQuery);

  if (existingSnapshot.empty) {
    await addDoc(collection(db, 'absenceStatistics'), statsData);
  } else {
    const docRef = doc(db, 'absenceStatistics', existingSnapshot.docs.id);
    await updateDoc(docRef, statsData);
  }
};

// Expenses
export const getExpenses = async (adminUserId: string, employeeId?: string): Promise<Expense[]> => {
  let q;

  if (employeeId) {
    q = query(
      collection(db, 'expenses'),
      where('userId', '==', adminUserId),
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc')
    );
  } else {
    q = query(
      collection(db, 'expenses'),
      where('userId', '==', adminUserId),
      orderBy('date', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  const expenses = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Expense));
  
  return expenses;
};

export const createExpense = async (adminUserId: string, expense: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  
  // Clean up undefined values that Firestore doesn't accept
  const cleanExpense = {
    ...expense,
    travelDetails: expense.travelDetails || null,
    vatAmount: expense.vatAmount || 0,
    project: expense.project || null,
    costCenter: expense.costCenter || null,
    paidInPayroll: expense.paidInPayroll || null,
  };

  const expenseData = convertToTimestamps({
    ...cleanExpense,
    userId: adminUserId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'expenses'), expenseData);
  return docRef.id;
};

export const updateExpense = async (id: string, userId: string, updates: Partial<Expense>): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
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

export const approveExpense = async (id: string, userId: string, approverName: string, approverId: string, comment?: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const expenseData = docSnap.data();
  const approvals = expenseData.approvals || [];

  approvals.push({
    level: approvals.length + 1,
    approverName,
    approverId,
    approvedAt: new Date(),
    comment
  });

  const updateData = convertToTimestamps({
    status: 'approved',
    approvals,
    updatedAt: new Date()
  });

  await updateDoc(docRef, updateData);
};

export const rejectExpense = async (id: string, userId: string, approverName: string, approverId: string, comment: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const expenseData = docSnap.data();
  const approvals = expenseData.approvals || [];

  approvals.push({
    level: approvals.length + 1,
    approverName,
    approverId,
    rejectedAt: new Date(),
    comment
  });

  const updateData = convertToTimestamps({
    status: 'rejected',
    approvals,
    updatedAt: new Date()
  });

  await updateDoc(docRef, updateData);
};

export const getPendingExpenses = async (companyId: string, userId: string): Promise<Expense[]> => {
  const q = query(
    collection(db, 'expenses'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    where('status', '==', 'submitted'),
    orderBy('submittedAt', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Expense));
};

export const calculateTravelExpense = (kilometers: number, ratePerKm: number = 0.23): number => {
  return kilometers * ratePerKm;
};