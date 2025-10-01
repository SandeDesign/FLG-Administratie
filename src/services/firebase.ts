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
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Company,
  Employee,
  Branch,
  LeaveRequest,
  LeaveBalance,
  Expense,
  SickLeave,
  AbsenceStatistics,
  UserRole,
} from '../types';

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any): any => {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert common timestamp fields
  const timestampFields = [
    'createdAt', 'updatedAt', 'startDate', 'endDate', 'dateOfBirth',
    'submittedAt', 'approvedAt', 'rejectedAt', 'reportedAt', 'actualReturnDate',
    'date', 'expires', 'calculatedAt'
  ];
  
  timestampFields.forEach(field => {
    if (converted[field] && typeof converted[field].toDate === 'function') {
      converted[field] = converted[field].toDate();
    }
  });
  
  // Handle nested objects
  if (converted.personalInfo?.dateOfBirth && typeof converted.personalInfo.dateOfBirth.toDate === 'function') {
    converted.personalInfo.dateOfBirth = converted.personalInfo.dateOfBirth.toDate();
  }
  
  if (converted.contractInfo?.startDate && typeof converted.contractInfo.startDate.toDate === 'function') {
    converted.contractInfo.startDate = converted.contractInfo.startDate.toDate();
  }
  
  if (converted.contractInfo?.endDate && typeof converted.contractInfo.endDate.toDate === 'function') {
    converted.contractInfo.endDate = converted.contractInfo.endDate.toDate();
  }
  
  if (converted.leaveInfo?.holidayDays?.expiryDate && typeof converted.leaveInfo.holidayDays.expiryDate.toDate === 'function') {
    converted.leaveInfo.holidayDays.expiryDate = converted.leaveInfo.holidayDays.expiryDate.toDate();
  }
  
  if (converted.holidayDays?.expires && typeof converted.holidayDays.expires.toDate === 'function') {
    converted.holidayDays.expires = converted.holidayDays.expires.toDate();
  }
  
  return converted;
};

// Helper function to convert Date objects to Firestore timestamps
const convertToTimestamps = (data: any): any => {
  if (!data) return data;
  
  const converted = { ...data };
  
  // Convert common date fields
  const dateFields = [
    'createdAt', 'updatedAt', 'startDate', 'endDate', 'dateOfBirth',
    'submittedAt', 'approvedAt', 'rejectedAt', 'reportedAt', 'actualReturnDate',
    'date', 'expires', 'calculatedAt'
  ];
  
  dateFields.forEach(field => {
    if (converted[field] instanceof Date) {
      converted[field] = Timestamp.fromDate(converted[field]);
    }
  });
  
  // Handle nested objects
  if (converted.personalInfo?.dateOfBirth instanceof Date) {
    converted.personalInfo.dateOfBirth = Timestamp.fromDate(converted.personalInfo.dateOfBirth);
  }
  
  if (converted.contractInfo?.startDate instanceof Date) {
    converted.contractInfo.startDate = Timestamp.fromDate(converted.contractInfo.startDate);
  }
  
  if (converted.contractInfo?.endDate instanceof Date) {
    converted.contractInfo.endDate = Timestamp.fromDate(converted.contractInfo.endDate);
  }
  
  if (converted.leaveInfo?.holidayDays?.expiryDate instanceof Date) {
    converted.leaveInfo.holidayDays.expiryDate = Timestamp.fromDate(converted.leaveInfo.holidayDays.expiryDate);
  }
  
  if (converted.holidayDays?.expires instanceof Date) {
    converted.holidayDays.expires = Timestamp.fromDate(converted.holidayDays.expires);
  }
  
  return converted;
};

// User role functions
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const q = query(
      collection(db, 'userRoles'),
      where('uid', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as UserRole;
    }
    
    // If no role found, check if user is an employee
    const employeeQuery = query(
      collection(db, 'employees'),
      where('personalInfo.contactInfo.email', '==', userId)
    );
    const employeeSnapshot = await getDocs(employeeQuery);
    
    if (!employeeSnapshot.empty) {
      const employeeDoc = employeeSnapshot.docs[0];
      return {
        uid: userId,
        role: 'employee',
        employeeId: employeeDoc.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user role:', error);
    throw error;
  }
};

export const createUserRole = async (userId: string, role: 'admin' | 'employee', employeeId?: string): Promise<string> => {
  try {
    const roleData = convertToTimestamps({
      uid: userId,
      role,
      employeeId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'userRoles'), roleData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating user role:', error);
    throw error;
  }
};

// Company functions
export const getCompanies = async (userId: string): Promise<Company[]> => {
  try {
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
  } catch (error) {
    console.error('Error fetching companies:', error);
    throw error;
  }
};

export const createCompany = async (userId: string, companyData: Omit<Company, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...companyData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'companies'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating company:', error);
    throw error;
  }
};

export const updateCompany = async (companyId: string, userId: string, updates: Partial<Company>): Promise<void> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists() || companyDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    const updateData = convertToTimestamps({
      ...updates,
      updatedAt: new Date()
    });
    
    await updateDoc(companyRef, updateData);
  } catch (error) {
    console.error('Error updating company:', error);
    throw error;
  }
};

export const deleteCompany = async (companyId: string, userId: string): Promise<void> => {
  try {
    const companyRef = doc(db, 'companies', companyId);
    const companyDoc = await getDoc(companyRef);
    
    if (!companyDoc.exists() || companyDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await deleteDoc(companyRef);
  } catch (error) {
    console.error('Error deleting company:', error);
    throw error;
  }
};

// Branch functions
export const getBranches = async (userId: string, companyId?: string): Promise<Branch[]> => {
  try {
    let q = query(
      collection(db, 'branches'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let branches = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as Branch));
    
    if (companyId) {
      branches = branches.filter(branch => branch.companyId === companyId);
    }
    
    return branches;
  } catch (error) {
    console.error('Error fetching branches:', error);
    throw error;
  }
};

export const createBranch = async (userId: string, branchData: Omit<Branch, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...branchData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'branches'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
};

export const updateBranch = async (branchId: string, userId: string, updates: Partial<Branch>): Promise<void> => {
  try {
    const branchRef = doc(db, 'branches', branchId);
    const branchDoc = await getDoc(branchRef);
    
    if (!branchDoc.exists() || branchDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    const updateData = convertToTimestamps({
      ...updates,
      updatedAt: new Date()
    });
    
    await updateDoc(branchRef, updateData);
  } catch (error) {
    console.error('Error updating branch:', error);
    throw error;
  }
};

export const deleteBranch = async (branchId: string, userId: string): Promise<void> => {
  try {
    const branchRef = doc(db, 'branches', branchId);
    const branchDoc = await getDoc(branchRef);
    
    if (!branchDoc.exists() || branchDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await deleteDoc(branchRef);
  } catch (error) {
    console.error('Error deleting branch:', error);
    throw error;
  }
};

// Employee functions
export const getEmployees = async (userId: string, companyId?: string): Promise<Employee[]> => {
  try {
    let q = query(
      collection(db, 'employees'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let employees = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as Employee));
    
    if (companyId) {
      employees = employees.filter(employee => employee.companyId === companyId);
    }
    
    return employees;
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

export const getEmployeeById = async (employeeId: string): Promise<Employee | null> => {
  try {
    const employeeRef = doc(db, 'employees', employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists()) {
      return null;
    }
    
    return {
      id: employeeDoc.id,
      ...convertTimestamps(employeeDoc.data())
    } as Employee;
  } catch (error) {
    console.error('Error fetching employee:', error);
    throw error;
  }
};

export const createEmployee = async (userId: string, employeeData: Omit<Employee, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...employeeData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'employees'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating employee:', error);
    throw error;
  }
};

export const updateEmployee = async (employeeId: string, userId: string, updates: Partial<Employee>): Promise<void> => {
  try {
    const employeeRef = doc(db, 'employees', employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists() || employeeDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    const updateData = convertToTimestamps({
      ...updates,
      updatedAt: new Date()
    });
    
    await updateDoc(employeeRef, updateData);
  } catch (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
};

export const deleteEmployee = async (employeeId: string, userId: string): Promise<void> => {
  try {
    const employeeRef = doc(db, 'employees', employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (!employeeDoc.exists() || employeeDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await deleteDoc(employeeRef);
  } catch (error) {
    console.error('Error deleting employee:', error);
    throw error;
  }
};

// Leave request functions
export const getLeaveRequests = async (userId: string, employeeId?: string): Promise<LeaveRequest[]> => {
  try {
    let q = query(
      collection(db, 'leaveRequests'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as LeaveRequest));
    
    if (employeeId) {
      requests = requests.filter(request => request.employeeId === employeeId);
    }
    
    return requests;
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    throw error;
  }
};

export const createLeaveRequest = async (userId: string, requestData: Omit<LeaveRequest, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...requestData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'leaveRequests'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating leave request:', error);
    throw error;
  }
};

export const approveLeaveRequest = async (requestId: string, userId: string, approvedBy: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'leaveRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists() || requestDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await updateDoc(requestRef, {
      status: 'approved',
      approvedBy,
      approvedAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error approving leave request:', error);
    throw error;
  }
};

export const rejectLeaveRequest = async (requestId: string, userId: string, rejectedBy: string, reason: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'leaveRequests', requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists() || requestDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectedReason: reason,
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error rejecting leave request:', error);
    throw error;
  }
};

export const getPendingLeaveApprovals = async (companyId: string, userId: string): Promise<LeaveRequest[]> => {
  try {
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
  } catch (error) {
    console.error('Error fetching pending leave approvals:', error);
    throw error;
  }
};

export const getLeaveBalance = async (employeeId: string, userId: string, year: number): Promise<LeaveBalance | null> => {
  try {
    const q = query(
      collection(db, 'leaveBalances'),
      where('employeeId', '==', employeeId),
      where('year', '==', year)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as LeaveBalance;
    }
    
    // Create default balance if none exists
    const employee = await getEmployeeById(employeeId);
    if (!employee) return null;
    
    const defaultBalance: Omit<LeaveBalance, 'id'> = {
      employeeId,
      companyId: employee.companyId,
      year,
      holidayDays: {
        statutory: employee.contractInfo.hoursPerWeek * 4,
        extraStatutory: 0,
        carried: 0,
        accumulated: 0,
        taken: 0,
        pending: 0,
        remaining: employee.contractInfo.hoursPerWeek * 4,
        expires: new Date(year + 5, 11, 31)
      },
      advDays: {
        entitled: 0,
        accumulated: 0,
        taken: 0,
        remaining: 0
      },
      seniorDays: 0,
      snipperDays: 0,
      updatedAt: new Date()
    };
    
    const data = convertToTimestamps(defaultBalance);
    const docRef = await addDoc(collection(db, 'leaveBalances'), data);
    
    return {
      id: docRef.id,
      ...defaultBalance
    };
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    throw error;
  }
};

// Expense functions
export const getExpenses = async (userId: string, employeeId?: string): Promise<Expense[]> => {
  try {
    let q = query(
      collection(db, 'expenses'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let expenses = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as Expense));
    
    if (employeeId) {
      expenses = expenses.filter(expense => expense.employeeId === employeeId);
    }
    
    return expenses;
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

export const createExpense = async (userId: string, expenseData: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...expenseData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'expenses'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating expense:', error);
    throw error;
  }
};

export const approveExpense = async (expenseId: string, userId: string, approverName: string, approverId: string, comment?: string): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    const expenseDoc = await getDoc(expenseRef);
    
    if (!expenseDoc.exists() || expenseDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await updateDoc(expenseRef, {
      status: 'approved',
      approvals: [{
        level: 1,
        approverName,
        approverId,
        approvedAt: new Date(),
        comment
      }],
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error approving expense:', error);
    throw error;
  }
};

export const rejectExpense = async (expenseId: string, userId: string, rejectedBy: string, rejectedById: string, reason: string): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    const expenseDoc = await getDoc(expenseRef);
    
    if (!expenseDoc.exists() || expenseDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await updateDoc(expenseRef, {
      status: 'rejected',
      approvals: [{
        level: 1,
        approverName: rejectedBy,
        approverId: rejectedById,
        rejectedAt: new Date(),
        comment: reason
      }],
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error rejecting expense:', error);
    throw error;
  }
};

export const getPendingExpenses = async (companyId: string, userId: string): Promise<Expense[]> => {
  try {
    const q = query(
      collection(db, 'expenses'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      where('status', '==', 'submitted'),
      orderBy('createdAt', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as Expense));
  } catch (error) {
    console.error('Error fetching pending expenses:', error);
    throw error;
  }
};

export const calculateTravelExpense = (kilometers: number, ratePerKm: number): number => {
  return kilometers * ratePerKm;
};

// Sick leave functions
export const getSickLeaveRecords = async (userId: string, employeeId?: string): Promise<SickLeave[]> => {
  try {
    let q = query(
      collection(db, 'sickLeave'),
      where('userId', '==', userId),
      orderBy('startDate', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    } as SickLeave));
    
    if (employeeId) {
      records = records.filter(record => record.employeeId === employeeId);
    }
    
    return records;
  } catch (error) {
    console.error('Error fetching sick leave records:', error);
    throw error;
  }
};

export const createSickLeave = async (userId: string, sickLeaveData: Omit<SickLeave, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    const data = convertToTimestamps({
      ...sickLeaveData,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const docRef = await addDoc(collection(db, 'sickLeave'), data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating sick leave:', error);
    throw error;
  }
};

export const updateSickLeave = async (sickLeaveId: string, userId: string, updates: Partial<SickLeave>): Promise<void> => {
  try {
    const sickLeaveRef = doc(db, 'sickLeave', sickLeaveId);
    const sickLeaveDoc = await getDoc(sickLeaveRef);
    
    if (!sickLeaveDoc.exists() || sickLeaveDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    const updateData = convertToTimestamps({
      ...updates,
      updatedAt: new Date()
    });
    
    await updateDoc(sickLeaveRef, updateData);
  } catch (error) {
    console.error('Error updating sick leave:', error);
    throw error;
  }
};

export const deleteSickLeave = async (sickLeaveId: string, userId: string): Promise<void> => {
  try {
    const sickLeaveRef = doc(db, 'sickLeave', sickLeaveId);
    const sickLeaveDoc = await getDoc(sickLeaveRef);
    
    if (!sickLeaveDoc.exists() || sickLeaveDoc.data().userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    await deleteDoc(sickLeaveRef);
  } catch (error) {
    console.error('Error deleting sick leave:', error);
    throw error;
  }
};

export const getAbsenceStatistics = async (employeeId: string, userId: string, year: number): Promise<AbsenceStatistics | null> => {
  try {
    const q = query(
      collection(db, 'absenceStatistics'),
      where('employeeId', '==', employeeId),
      where('periodStart', '>=', Timestamp.fromDate(new Date(year, 0, 1))),
      where('periodStart', '<', Timestamp.fromDate(new Date(year + 1, 0, 1)))
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as AbsenceStatistics;
    }
    
    // Calculate statistics from sick leave records
    const sickLeaveRecords = await getSickLeaveRecords(userId, employeeId);
    const yearRecords = sickLeaveRecords.filter(record => 
      record.startDate.getFullYear() === year
    );
    
    if (yearRecords.length === 0) {
      return null;
    }
    
    const totalSickDays = yearRecords.reduce((sum, record) => {
      const endDate = record.endDate || new Date();
      const duration = Math.floor((endDate.getTime() - record.startDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + duration;
    }, 0);
    
    const totalWorkingDays = 260; // Approximate working days in a year
    const absencePercentage = (totalSickDays / totalWorkingDays) * 100;
    
    const stats: Omit<AbsenceStatistics, 'id'> = {
      employeeId,
      companyId: yearRecords[0].companyId,
      period: 'year',
      periodStart: new Date(year, 0, 1),
      periodEnd: new Date(year, 11, 31),
      totalSickDays,
      totalSickHours: totalSickDays * 8,
      absenceFrequency: yearRecords.length,
      averageDuration: totalSickDays / yearRecords.length,
      absencePercentage,
      longTermAbsence: yearRecords.some(record => {
        const endDate = record.endDate || new Date();
        const duration = Math.floor((endDate.getTime() - record.startDate.getTime()) / (1000 * 60 * 60 * 24));
        return duration > 42; // More than 6 weeks
      }),
      chronicAbsence: yearRecords.length > 3,
      calculatedAt: new Date()
    };
    
    return stats;
  } catch (error) {
    console.error('Error fetching absence statistics:', error);
    throw error;
  }
};