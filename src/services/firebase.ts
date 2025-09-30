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
import { Company, Branch, Employee, TimeEntry, UserRole } from '../types';

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
  console.log('Firebase createEmployee called with userId:', userId);
  console.log('Employee data received in createEmployee:', employee);
  
  const employeeData = convertToTimestamps({
    ...employee,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log('Employee data after timestamp conversion:', employeeData);
  
  try {
    console.log('Attempting to add document to Firestore...');
    const docRef = await addDoc(collection(db, 'employees'), employeeData);
    console.log('Document successfully added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Firestore error in createEmployee:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
};

export const updateEmployee = async (id: string, userId: string, updates: Partial<Employee>): Promise<void> => {
  console.log('Firebase updateEmployee called with:', { id, userId });
  console.log('Update data received:', updates);
  
  // First verify ownership
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    console.error('Unauthorized access attempt or document not found');
    throw new Error('Unauthorized');
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  console.log('Update data after timestamp conversion:', updateData);
  
  try {
    console.log('Attempting to update document in Firestore...');
    await updateDoc(docRef, updateData);
    console.log('Document successfully updated');
  } catch (error) {
    console.error('Firestore error in updateEmployee:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
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
  
  const doc = querySnapshot.docs[0];
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