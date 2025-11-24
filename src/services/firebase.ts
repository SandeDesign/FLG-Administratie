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
import { Company, Branch, Employee, TimeEntry, UserRole, LeaveRequest, LeaveBalance, SickLeave, AbsenceStatistics, Expense, EmployeeWithCompanies, CompanyWithEmployees, UserSettings, BudgetItem } from '../types';
import { generatePoortwachterMilestones, shouldActivatePoortwachter } from '../utils/poortwachterTracking';

// Helper function to remove undefined values from objects (Firebase doesn't accept undefined)
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};

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

// Get companies with filtering by type
export const getCompaniesByType = async (userId: string, companyType?: 'employer' | 'project'): Promise<Company[]> => {
  let q;
  
  if (companyType) {
    q = query(
      collection(db, 'companies'),
      where('userId', '==', userId),
      where('companyType', '==', companyType),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, 'companies'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
  }
  
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

// ✅ NEW: Get company without userId check (for managers loading their assigned company)
export const getCompanyById = async (id: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as Company;
};

// Updated createCompany with undefined value filtering
export const createCompany = async (userId: string, company: Omit<Company, 'id' | 'userId'>): Promise<string> => {
  // Validate project company has primaryEmployerId
  if (company.companyType === 'project' && !company.primaryEmployerId) {
    throw new Error('Project companies must have a primaryEmployerId');
  }
  
  // Validate primary employer exists and is owned by same user
  if (company.companyType === 'project' && company.primaryEmployerId) {
    const primaryEmployer = await getCompany(company.primaryEmployerId, userId);
    if (!primaryEmployer || primaryEmployer.companyType !== 'employer') {
      throw new Error('Invalid primary employer');
    }
  }
  
  const companyData = convertToTimestamps({
    ...company,
    userId,
    companyType: company.companyType || 'employer', // Default to employer
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Remove undefined values before sending to Firebase
  const cleanedData = removeUndefinedValues(companyData);
  
  const docRef = await addDoc(collection(db, 'companies'), cleanedData);
  return docRef.id;
};

// Updated updateCompany with undefined value filtering
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
  
  // Remove undefined values before sending to Firebase
  const cleanedData = removeUndefinedValues(updateData);
  
  await updateDoc(docRef, cleanedData);
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
  
  const cleanedData = removeUndefinedValues(branchData);
  const docRef = await addDoc(collection(db, 'branches'), cleanedData);
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
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

// Get employees with their project companies populated
export const getEmployeesWithProjectCompanies = async (userId: string, companyId?: string): Promise<EmployeeWithCompanies[]> => {
  const employees = await getEmployees(userId, companyId);
  const companies = await getCompanies(userId);
  
  return employees.map(employee => ({
    ...employee,
    primaryEmployer: companies.find(c => c.id === employee.companyId),
    projectCompaniesData: employee.projectCompanies?.map(pcId => 
      companies.find(c => c.id === pcId)
    ).filter(Boolean) || []
  }));
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

// Updated createEmployee with project companies support
export const createEmployee = async (userId: string, employee: Omit<Employee, 'id' | 'userId'>): Promise<string> => {
  // Validate primary company exists and is owned by user
  const primaryCompany = await getCompany(employee.companyId, userId);
  if (!primaryCompany) {
    throw new Error('Invalid primary company');
  }
  
  // Validate project companies exist and are owned by user
  if (employee.projectCompanies && employee.projectCompanies.length > 0) {
    const projectCompanies = await Promise.all(
      employee.projectCompanies.map(pcId => getCompany(pcId, userId))
    );
    
    if (projectCompanies.some(pc => !pc)) {
      throw new Error('One or more project companies are invalid');
    }
    
    // Ensure all project companies are actually project type
    if (projectCompanies.some(pc => pc?.companyType !== 'project')) {
      throw new Error('All project companies must be of type "project"');
    }
  }
  
  const employeeData = convertToTimestamps({
    ...employee,
    userId,
    projectCompanies: employee.projectCompanies || [], // Ensure array exists
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(employeeData);
  const docRef = await addDoc(collection(db, 'employees'), cleanedData);
  return docRef.id;
};

// Updated updateEmployee with project companies support
export const updateEmployee = async (id: string, userId: string, updates: Partial<Employee>): Promise<void> => {
  // First verify ownership
  const docRef = doc(db, 'employees', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }
  
  // Validate project companies if they're being updated
  if (updates.projectCompanies) {
    const projectCompanies = await Promise.all(
      updates.projectCompanies.map(pcId => getCompany(pcId, userId))
    );
    
    if (projectCompanies.some(pc => !pc || pc.companyType !== 'project')) {
      throw new Error('All project companies must be valid and of type "project"');
    }
  }
  
  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

// Get employees for a specific project company
export const getEmployeesForProjectCompany = async (userId: string, projectCompanyId: string): Promise<Employee[]> => {
  const q = query(
    collection(db, 'employees'),
    where('userId', '==', userId),
    where('projectCompanies', 'array-contains', projectCompanyId)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Employee));
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
  
  const cleanedData = removeUndefinedValues(entryData);
  const docRef = await addDoc(collection(db, 'timeEntries'), cleanedData);
  return docRef.id;
};

// Create time entry with work company support
export const createTimeEntryWithWorkCompany = async (
  userId: string, 
  timeEntry: Omit<TimeEntry, 'id' | 'userId'>
): Promise<string> => {
  // Validate work company if specified
  if (timeEntry.workCompanyId) {
    const workCompany = await getCompany(timeEntry.workCompanyId, userId);
    if (!workCompany) {
      throw new Error('Invalid work company');
    }
    
    // Verify employee is allowed to work for this company
    const employee = await getEmployee(timeEntry.employeeId, userId);
    if (!employee) {
      throw new Error('Invalid employee');
    }
    
    const allowedCompanies = [employee.companyId, ...(employee.projectCompanies || [])];
    if (!allowedCompanies.includes(timeEntry.workCompanyId)) {
      throw new Error('Employee is not authorized to work for this company');
    }
  }
  
  const timeEntryData = convertToTimestamps({
    ...timeEntry,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(timeEntryData);
  const docRef = await addDoc(collection(db, 'timeEntries'), cleanedData);
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
  
  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

// User Roles
export const createUserRole = async (
  uid: string, 
  role: 'admin' | 'manager' | 'employee', 
  employeeId?: string,
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    assignedCompanyId?: string;
  }
): Promise<void> => {
  const roleData = convertToTimestamps({
    uid,
    role,
    employeeId: employeeId || null,
    firstName: userData?.firstName || '',
    lastName: userData?.lastName || '',
    email: userData?.email || '',
    ...(role === 'manager' && { assignedCompanyId: userData?.assignedCompanyId || null }),
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(roleData);
  await addDoc(collection(db, 'users'), cleanedData);
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
    
    const cleanedData = removeUndefinedValues(updateData);
    await updateDoc(employeeRef, cleanedData);
    
    // Create user role for the new employee
    const employee = await getEmployee(employeeId, userId);
    await createUserRole(newUserId, 'employee', employeeId, {
      firstName: employee?.personalInfo.firstName,
      lastName: employee?.personalInfo.lastName,
      email: employee?.personalInfo.contactInfo.email,
    });
    
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

// ✅ NIEUW: Save temporary credentials (for employee account creation)
export const saveTemporaryCredentials = async (
  employeeId: string,
  email: string,
  password: string
): Promise<void> => {
  try {
    // Store temporary credentials in a separate collection for later use
    const credentialsData = convertToTimestamps({
      employeeId,
      email,
      password, // Note: In production, encrypt this before storing
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
    });

    const cleanedData = removeUndefinedValues(credentialsData);
    await addDoc(collection(db, 'temporaryCredentials'), cleanedData);
  } catch (error) {
    console.error('Error saving temporary credentials:', error);
    throw error;
  }
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

  const cleanedData = removeUndefinedValues(requestData);
  const docRef = await addDoc(collection(db, 'leaveRequests'), cleanedData);
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

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

  const docData = querySnapshot.docs[0];
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

  const cleanedData = removeUndefinedValues(balanceData);

  if (querySnapshot.empty) {
    await addDoc(collection(db, 'leaveBalances'), cleanedData);
  } else {
    const docRef = doc(db, 'leaveBalances', querySnapshot.docs[0].id);
    await updateDoc(docRef, cleanedData);
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
  const milestones = shouldActivate ? generatePoortwachterMilestones(sickLeave.startDate) : null;

  const sickLeaveData = convertToTimestamps({
    ...sickLeave,
    userId: adminUserId,
    poortwachterActive: shouldActivate,
    poortwachterMilestones: milestones,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(sickLeaveData);
  const docRef = await addDoc(collection(db, 'sickLeave'), cleanedData);
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

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

  const docData = querySnapshot.docs[0];
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
  const cleanedData = removeUndefinedValues(statsData);

  if (existingSnapshot.empty) {
    await addDoc(collection(db, 'absenceStatistics'), cleanedData);
  } else {
    const docRef = doc(db, 'absenceStatistics', existingSnapshot.docs[0].id);
    await updateDoc(docRef, cleanedData);
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

  const cleanedData = removeUndefinedValues(expenseData);
  const docRef = await addDoc(collection(db, 'expenses'), cleanedData);
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

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
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

// Submit expense for approval (change status from draft to submitted)
export const submitExpense = async (id: string, userId: string, submittedBy: string): Promise<void> => {
  const docRef = doc(db, 'expenses', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  const updateData = convertToTimestamps({
    status: 'submitted',
    submittedBy,
    submittedAt: new Date(),
    updatedAt: new Date()
  });

  const cleanedData = removeUndefinedValues(updateData);
  await updateDoc(docRef, cleanedData);
};

// ✅ NIEUW: User Settings functies
export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const q = query(
    collection(db, 'userSettings'),
    where('userId', '==', userId)
  );
  
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  const docSnap = querySnapshot.docs[0];
  return {
    id: docSnap.id,
    ...convertTimestamps(docSnap.data())
  } as UserSettings;
};

export const saveUserSettings = async (userId: string, settings: Partial<UserSettings>): Promise<void> => {
  const existingSettings = await getUserSettings(userId);
  
  const settingsData = convertToTimestamps({
    userId,
    ...settings,
    updatedAt: new Date()
  });
  
  const cleanedData = removeUndefinedValues(settingsData);
  
  if (existingSettings) {
    // Update
    const docRef = doc(db, 'userSettings', existingSettings.id);
    await updateDoc(docRef, cleanedData);
  } else {
    // Create
    const createData = convertToTimestamps({
      userId,
      ...settings,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await addDoc(collection(db, 'userSettings'), removeUndefinedValues(createData));
  }
};

// Helper function to check if user can manage a company
export const canUserManageCompany = async (userId: string, companyId: string): Promise<boolean> => {
  try {
    const company = await getCompany(companyId, userId);
    return !!company; // User can manage if they own the company
  } catch {
    return false;
  }
};

// Get company hierarchy (employer with its project companies)
export const getCompanyHierarchy = async (userId: string): Promise<CompanyWithEmployees[]> => {
  const companies = await getCompanies(userId);
  const employees = await getEmployees(userId);
  
  const employerCompanies = companies.filter(c => c.companyType === 'employer');
  
  return employerCompanies.map(employer => ({
    ...employer,
    employees: employees.filter(emp => emp.companyId === employer.id),
    projectCompanies: companies.filter(c => 
      c.companyType === 'project' && c.primaryEmployerId === employer.id
    )
  }));
};

// Smart company selector data voor forms
export interface CompanySelectData {
  employerCompanies: Company[];
  projectCompanies: Company[];
  employeeCanWorkFor: Company[]; // Voor specifieke employee
}

export const getCompanySelectData = async (
  userId: string,
  employeeId?: string
): Promise<CompanySelectData> => {
  const companies = await getCompanies(userId);
  const employerCompanies = companies.filter(c => c.companyType === 'employer');
  const projectCompanies = companies.filter(c => c.companyType === 'project');

  let employeeCanWorkFor: Company[] = employerCompanies; // Default to all employers

  if (employeeId) {
    const employee = await getEmployee(employeeId, userId);
    if (employee) {
      const allowedCompanyIds = [employee.companyId, ...(employee.projectCompanies || [])];
      employeeCanWorkFor = companies.filter(c => allowedCompanyIds.includes(c.id));
    }
  }

  return {
    employerCompanies,
    projectCompanies,
    employeeCanWorkFor
  };
};

// =============================================================================
// BUDGET ITEMS (Begroting - Terugkerende kosten)
// =============================================================================

export const getBudgetItems = async (userId: string, companyId?: string): Promise<BudgetItem[]> => {
  try {
    let q;
    if (companyId) {
      q = query(
        collection(db, 'budgetItems'),
        where('userId', '==', userId),
        where('companyId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'budgetItems'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as BudgetItem[];
  } catch (error) {
    console.error('Error fetching budget items:', error);
    throw error;
  }
};

export const getBudgetItem = async (budgetItemId: string, userId: string): Promise<BudgetItem | null> => {
  try {
    const docRef = doc(db, 'budgetItems', budgetItemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    if (data.userId !== userId) {
      throw new Error('Unauthorized access to budget item');
    }

    return {
      id: docSnap.id,
      ...convertTimestamps(data)
    } as BudgetItem;
  } catch (error) {
    console.error('Error fetching budget item:', error);
    throw error;
  }
};

export const createBudgetItem = async (
  budgetItem: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<BudgetItem> => {
  try {
    const now = Timestamp.now();
    const dataToSave = removeUndefinedValues({
      ...budgetItem,
      userId,
      startDate: budgetItem.startDate instanceof Date
        ? Timestamp.fromDate(budgetItem.startDate)
        : budgetItem.startDate,
      endDate: budgetItem.endDate instanceof Date
        ? Timestamp.fromDate(budgetItem.endDate)
        : budgetItem.endDate,
      createdAt: now,
      updatedAt: now,
    });

    const docRef = await addDoc(collection(db, 'budgetItems'), dataToSave);

    return {
      id: docRef.id,
      ...budgetItem,
      userId,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    } as BudgetItem;
  } catch (error) {
    console.error('Error creating budget item:', error);
    throw error;
  }
};

export const updateBudgetItem = async (
  budgetItemId: string,
  updates: Partial<BudgetItem>,
  userId: string
): Promise<void> => {
  try {
    // Verify ownership
    const existing = await getBudgetItem(budgetItemId, userId);
    if (!existing) {
      throw new Error('Budget item not found or unauthorized');
    }

    const dataToUpdate = removeUndefinedValues({
      ...updates,
      startDate: updates.startDate instanceof Date
        ? Timestamp.fromDate(updates.startDate)
        : updates.startDate,
      endDate: updates.endDate instanceof Date
        ? Timestamp.fromDate(updates.endDate)
        : updates.endDate,
      updatedAt: Timestamp.now(),
    });

    // Remove id and userId from updates
    delete dataToUpdate.id;
    delete dataToUpdate.userId;

    const docRef = doc(db, 'budgetItems', budgetItemId);
    await updateDoc(docRef, dataToUpdate);
  } catch (error) {
    console.error('Error updating budget item:', error);
    throw error;
  }
};

export const deleteBudgetItem = async (budgetItemId: string, userId: string): Promise<void> => {
  try {
    // Verify ownership
    const existing = await getBudgetItem(budgetItemId, userId);
    if (!existing) {
      throw new Error('Budget item not found or unauthorized');
    }

    const docRef = doc(db, 'budgetItems', budgetItemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting budget item:', error);
    throw error;
  }
};

// Helper: Calculate monthly budget total for a company
export const calculateMonthlyBudget = (budgetItems: BudgetItem[]): number => {
  return budgetItems
    .filter(item => item.isActive)
    .reduce((total, item) => {
      switch (item.frequency) {
        case 'monthly':
          return total + item.amount;
        case 'quarterly':
          return total + (item.amount / 3);
        case 'yearly':
          return total + (item.amount / 12);
        default:
          return total;
      }
    }, 0);
};

// Helper: Calculate yearly budget total for a company
export const calculateYearlyBudget = (budgetItems: BudgetItem[]): number => {
  return budgetItems
    .filter(item => item.isActive)
    .reduce((total, item) => {
      switch (item.frequency) {
        case 'monthly':
          return total + (item.amount * 12);
        case 'quarterly':
          return total + (item.amount * 4);
        case 'yearly':
          return total + item.amount;
        default:
          return total;
      }
    }, 0);
};

// Helper: Get budget items by category
export const getBudgetItemsByCategory = (budgetItems: BudgetItem[]): Record<string, BudgetItem[]> => {
  return budgetItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, BudgetItem[]>);
};