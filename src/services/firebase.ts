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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Company, Branch, Employee, TimeEntry } from '../types';

// Companies
export const getCompanies = async (): Promise<Company[]> => {
  const querySnapshot = await getDocs(collection(db, 'companies'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
};

export const getCompany = async (id: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Company : null;
};

export const createCompany = async (company: Omit<Company, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'companies'), company);
  return docRef.id;
};

export const updateCompany = async (id: string, updates: Partial<Company>): Promise<void> => {
  const docRef = doc(db, 'companies', id);
  await updateDoc(docRef, { ...updates, updatedAt: new Date() });
};

export const deleteCompany = async (id: string): Promise<void> => {
  const docRef = doc(db, 'companies', id);
  await deleteDoc(docRef);
};

// Branches
export const getBranches = async (companyId?: string): Promise<Branch[]> => {
  const q = companyId 
    ? query(collection(db, 'branches'), where('companyId', '==', companyId))
    : collection(db, 'branches');
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
};

export const createBranch = async (branch: Omit<Branch, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'branches'), branch);
  return docRef.id;
};

export const updateBranch = async (id: string, updates: Partial<Branch>): Promise<void> => {
  const docRef = doc(db, 'branches', id);
  await updateDoc(docRef, { ...updates, updatedAt: new Date() });
};

export const deleteBranch = async (id: string): Promise<void> => {
  const docRef = doc(db, 'branches', id);
  await deleteDoc(docRef);
};

// Employees
export const getEmployees = async (companyId?: string): Promise<Employee[]> => {
  const q = companyId 
    ? query(collection(db, 'employees'), where('companyId', '==', companyId))
    : collection(db, 'employees');
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
};

export const getEmployee = async (id: string): Promise<Employee | null> => {
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Employee : null;
};

export const createEmployee = async (employee: Omit<Employee, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'employees'), employee);
  return docRef.id;
};

export const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<void> => {
  const docRef = doc(db, 'employees', id);
  await updateDoc(docRef, { ...updates, updatedAt: new Date() });
};

export const deleteEmployee = async (id: string): Promise<void> => {
  const docRef = doc(db, 'employees', id);
  await deleteDoc(docRef);
};

// Time Entries
export const getTimeEntries = async (employeeId?: string): Promise<TimeEntry[]> => {
  const q = employeeId 
    ? query(collection(db, 'timeEntries'), where('employeeId', '==', employeeId), orderBy('date', 'desc'))
    : query(collection(db, 'timeEntries'), orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
};

export const createTimeEntry = async (timeEntry: Omit<TimeEntry, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'timeEntries'), timeEntry);
  return docRef.id;
};

export const updateTimeEntry = async (id: string, updates: Partial<TimeEntry>): Promise<void> => {
  const docRef = doc(db, 'timeEntries', id);
  await updateDoc(docRef, { ...updates, updatedAt: new Date() });
};