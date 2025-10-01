// Firebase service functions
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  // Add your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Company functions
export const getCompanies = async (): Promise<any[]> => {
  try {
    const companiesRef = collection(db, 'companies');
    const snapshot = await getDocs(companiesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw error;
  }
};

// Employee functions
export const getEmployees = async (): Promise<any[]> => {
  try {
    const employeesRef = collection(db, 'employees');
    const snapshot = await getDocs(employeesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

// Branch functions
export const getBranches = async (): Promise<any[]> => {
  try {
    const branchesRef = collection(db, 'branches');
    const snapshot = await getDocs(branchesRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching branches:', error);
    throw error;
  }
};

// Expense functions
export const getPendingExpenses = async (): Promise<any[]> => {
  try {
    const expensesRef = collection(db, 'expenses');
    const q = query(expensesRef, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching pending expenses:', error);
    throw error;
  }
};

// Leave approval functions
export const getPendingLeaveApprovals = async (): Promise<any[]> => {
  try {
    const leaveRequestsRef = collection(db, 'leaveRequests');
    const q = query(leaveRequestsRef, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching pending leave approvals:', error);
    throw error;
  }
};

// Sick leave functions
export const createSickLeave = async (adminUserId: string, sickLeaveData: any): Promise<string> => {
  try {
    const sickLeaveRef = collection(db, 'sickLeave');
    const docRef = await addDoc(sickLeaveRef, {
      ...sickLeaveData,
      createdBy: adminUserId,
      createdAt: new Date(),
      status: 'active'
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating sick leave:', error);
    throw error;
  }
};

export const updateSickLeave = async (sickLeaveId: string, updateData: any): Promise<void> => {
  try {
    const sickLeaveRef = doc(db, 'sickLeave', sickLeaveId);
    await updateDoc(sickLeaveRef, {
      ...updateData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating sick leave:', error);
    throw error;
  }
};

export const deleteSickLeave = async (sickLeaveId: string): Promise<void> => {
  try {
    const sickLeaveRef = doc(db, 'sickLeave', sickLeaveId);
    await deleteDoc(sickLeaveRef);
  } catch (error) {
    console.error('Error deleting sick leave:', error);
    throw error;
  }
};

// Recovery functions
export const createRecovery = async (adminUserId: string, recoveryData: any): Promise<string> => {
  try {
    const recoveryRef = collection(db, 'recoveries');
    const docRef = await addDoc(recoveryRef, {
      ...recoveryData,
      createdBy: adminUserId,
      createdAt: new Date(),
      status: 'active'
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating recovery:', error);
    throw error;
  }
};

export const updateRecovery = async (recoveryId: string, updateData: any): Promise<void> => {
  try {
    const recoveryRef = doc(db, 'recoveries', recoveryId);
    await updateDoc(recoveryRef, {
      ...updateData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating recovery:', error);
    throw error;
  }
};

export const deleteRecovery = async (recoveryId: string): Promise<void> => {
  try {
    const recoveryRef = doc(db, 'recoveries', recoveryId);
    await deleteDoc(recoveryRef);
  } catch (error) {
    console.error('Error deleting recovery:', error);
    throw error;
  }
};