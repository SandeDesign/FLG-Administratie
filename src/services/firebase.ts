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
import { Company, Branch, Employee, TimeEntry } from '../types';

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any) => {
  const converted = { ...data };
  
  // Convert top-level timestamps
  if (converted.createdAt?.toDate) {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt?.toDate) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.date?.toDate) {
    converted.date = converted.date.toDate();
  }
  
  // Convert nested timestamps in personalInfo
  if (converted.personalInfo?.dateOfBirth?.toDate) {
    converted.personalInfo.dateOfBirth = converted.personalInfo.dateOfBirth.toDate();
  }
  
  // Convert nested timestamps in contractInfo
  if (converted.contractInfo?.startDate?.toDate) {
    converted.contractInfo.startDate = converted.contractInfo.startDate.toDate();
  }
  if (converted.contractInfo?.endDate?.toDate) {
    converted.contractInfo.endDate = converted.contractInfo.endDate.toDate();
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
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
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