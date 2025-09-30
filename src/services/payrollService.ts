import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  PayrollPeriod,
  PayrollCalculation,
  HourlyRate,
  Allowance,
  Deduction,
  PayrollTaxes,
  PayrollEarning,
  PayrollDeduction as PayrollDed
} from '../types/payroll';
import { WeeklyTimesheet } from '../types/timesheet';
import { Employee } from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  const dateFields = [
    'startDate', 'endDate', 'paymentDate', 'periodStartDate', 'periodEndDate',
    'effectiveDate', 'calculatedAt', 'createdAt', 'updatedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field] && typeof converted[field].toDate === 'function') {
      converted[field] = converted[field].toDate();
    }
  });

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  const dateFields = [
    'startDate', 'endDate', 'paymentDate', 'periodStartDate', 'periodEndDate',
    'effectiveDate', 'calculatedAt', 'createdAt', 'updatedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field] instanceof Date) {
      converted[field] = Timestamp.fromDate(converted[field]);
    }
  });

  return converted;
};

export const getPayrollPeriods = async (userId: string, companyId?: string): Promise<PayrollPeriod[]> => {
  let q = query(
    collection(db, 'payrollPeriods'),
    where('userId', '==', userId),
    orderBy('startDate', 'desc')
  );

  if (companyId) {
    q = query(
      collection(db, 'payrollPeriods'),
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      orderBy('startDate', 'desc')
    );
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as PayrollPeriod));
};

export const createPayrollPeriod = async (
  userId: string,
  period: Omit<PayrollPeriod, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const periodData = convertToTimestamps({
    ...period,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'payrollPeriods'), periodData);
  return docRef.id;
};

export const updatePayrollPeriod = async (
  id: string,
  userId: string,
  updates: Partial<PayrollPeriod>
): Promise<void> => {
  const docRef = doc(db, 'payrollPeriods', id);
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

export const getPayrollCalculations = async (
  userId: string,
  payrollPeriodId?: string,
  employeeId?: string
): Promise<PayrollCalculation[]> => {
  let q = query(
    collection(db, 'payrollCalculations'),
    where('userId', '==', userId),
    orderBy('periodStartDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  let calculations = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as PayrollCalculation));

  if (payrollPeriodId) {
    calculations = calculations.filter(c => c.payrollPeriodId === payrollPeriodId);
  }

  if (employeeId) {
    calculations = calculations.filter(c => c.employeeId === employeeId);
  }

  return calculations;
};

export const createPayrollCalculation = async (
  userId: string,
  calculation: Omit<PayrollCalculation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const calculationData = convertToTimestamps({
    ...calculation,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'payrollCalculations'), calculationData);
  return docRef.id;
};

export const calculatePayroll = async (
  employee: Employee,
  timesheets: WeeklyTimesheet[],
  periodStartDate: Date,
  periodEndDate: Date,
  hourlyRate: HourlyRate
): Promise<Omit<PayrollCalculation, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> => {
  const totalHours = timesheets.reduce((acc, ts) => ({
    regular: acc.regular + ts.totalRegularHours,
    overtime: acc.overtime + ts.totalOvertimeHours,
    evening: acc.evening + ts.totalEveningHours,
    night: acc.night + ts.totalNightHours,
    weekend: acc.weekend + ts.totalWeekendHours,
    travel: acc.travel + ts.totalTravelKilometers
  }), {
    regular: 0,
    overtime: 0,
    evening: 0,
    night: 0,
    weekend: 0,
    travel: 0
  });

  const baseRate = employee.salaryInfo.hourlyRate || hourlyRate.baseRate;

  const regularPay = totalHours.regular * baseRate;
  const overtimeRate = baseRate * (hourlyRate.overtimeMultiplier / 100);
  const overtimePay = totalHours.overtime * overtimeRate;

  const eveningRate = baseRate * (hourlyRate.eveningMultiplier / 100);
  const eveningPay = totalHours.evening * eveningRate;

  const nightRate = baseRate * (hourlyRate.nightMultiplier / 100);
  const nightPay = totalHours.night * nightRate;

  const weekendRate = baseRate * (hourlyRate.weekendMultiplier / 100);
  const weekendPay = totalHours.weekend * weekendRate;

  const travelRate = employee.salaryInfo.travelAllowance.amountPerKm || 0.23;
  const travelAllowance = totalHours.travel * travelRate;

  const grossPay = regularPay + overtimePay + eveningPay + nightPay + weekendPay;

  const vacationAccrual = (employee.salaryInfo.holidayAllowancePercentage / 100) * grossPay;

  const taxes = calculateTaxes(grossPay, employee);

  const netPay = grossPay - taxes.incomeTax - taxes.socialSecurityEmployee - taxes.pensionEmployee;

  return {
    employeeId: employee.id,
    companyId: employee.companyId,
    payrollPeriodId: '',
    periodStartDate,
    periodEndDate,

    regularHours: totalHours.regular,
    regularRate: baseRate,
    regularPay,

    overtimeHours: totalHours.overtime,
    overtimeRate,
    overtimePay,

    eveningHours: totalHours.evening,
    eveningRate,
    eveningPay,

    nightHours: totalHours.night,
    nightRate,
    nightPay,

    weekendHours: totalHours.weekend,
    weekendRate,
    weekendPay,

    holidayHours: 0,
    holidayRate: 0,
    holidayPay: 0,

    travelKilometers: totalHours.travel,
    travelRate,
    travelAllowance,

    otherEarnings: [],

    grossPay,

    taxes,

    deductions: [],

    netPay,

    vacationAccrual,
    vacationPay: vacationAccrual,

    ytdGross: 0,
    ytdNet: 0,
    ytdTax: 0,

    calculatedAt: new Date(),
    calculatedBy: '',
    status: 'draft'
  };
};

const calculateTaxes = (grossPay: number, employee: Employee): PayrollTaxes => {
  const taxRate = employee.salaryInfo.taxTable === 'green' ? 0.36 : 0.37;
  const incomeTax = grossPay * taxRate * (employee.salaryInfo.taxCredit ? 0.9 : 1);

  const aowRate = 0.1795;
  const wlzRate = 0.0945;
  const wwRate = 0.0282;
  const wiaRate = 0.0;

  const socialSecurityEmployee = grossPay * (aowRate + wlzRate + wwRate + wiaRate);

  const pensionEmployee = grossPay * (employee.salaryInfo.pensionContribution / 100);
  const pensionEmployer = grossPay * (employee.salaryInfo.pensionEmployerContribution / 100);

  return {
    incomeTax,
    socialSecurityEmployee,
    socialSecurityEmployer: socialSecurityEmployee,
    healthInsurance: 0,
    pensionEmployee,
    pensionEmployer,
    unemploymentInsurance: grossPay * wwRate,
    disabilityInsurance: grossPay * wiaRate
  };
};

export const getHourlyRates = async (userId: string, companyId: string): Promise<HourlyRate[]> => {
  const q = query(
    collection(db, 'hourlyRates'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    orderBy('effectiveDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as HourlyRate));
};

export const createHourlyRate = async (
  userId: string,
  rate: Omit<HourlyRate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const rateData = convertToTimestamps({
    ...rate,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'hourlyRates'), rateData);
  return docRef.id;
};

export const getAllowances = async (userId: string, companyId: string): Promise<Allowance[]> => {
  const q = query(
    collection(db, 'allowances'),
    where('userId', '==', userId),
    where('companyId', '==', companyId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Allowance));
};

export const getDeductions = async (userId: string, employeeId: string): Promise<Deduction[]> => {
  const q = query(
    collection(db, 'deductions'),
    where('userId', '==', userId),
    where('employeeId', '==', employeeId)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Deduction));
};
