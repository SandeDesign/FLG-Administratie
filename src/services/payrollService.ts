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

  console.log('🔥 FIREBASE UPDATE - Collection: payrollPeriods');
  console.log('📝 Document ID:', id);
  console.log('📦 UPDATE DATA:', JSON.stringify(updateData, null, 2));

  await updateDoc(docRef, updateData);

  console.log('✅ UPDATED');
};

export const getPayrollCalculations = async (
  userId: string,
  employeeId?: string,
  month?: number,
  year?: number
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

  if (employeeId) {
    calculations = calculations.filter(c => c.employeeId === employeeId);
  }

  if (month !== undefined && year !== undefined) {
    calculations = calculations.filter(c => {
      if (!c.periodStartDate) return false;
      const calcMonth = c.periodStartDate.getMonth() + 1;
      const calcYear = c.periodStartDate.getFullYear();
      return calcMonth === month && calcYear === year;
    });
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

  console.log('🔥 FIREBASE WRITE - Collection: payrollCalculations');
  console.log('📦 FULL DATA:', JSON.stringify(calculationData, null, 2));

  const docRef = await addDoc(collection(db, 'payrollCalculations'), calculationData);

  console.log('✅ SAVED - ID:', docRef.id);

  return docRef.id;
};

export const calculatePayroll = async (
  employee: Employee,
  timesheets: WeeklyTimesheet[],
  periodStartDate: Date,
  periodEndDate: Date,
  hourlyRate: HourlyRate
): Promise<Omit<PayrollCalculation, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> => {
  const paymentType = employee.salaryInfo.paymentType;

  // For monthly/annual salaries, calculate based on contract
  if (paymentType === 'monthly' || paymentType === 'annual') {
    let grossPay = 0;

    if (paymentType === 'monthly' && employee.salaryInfo.monthlySalary) {
      grossPay = Number(employee.salaryInfo.monthlySalary);
    } else if (paymentType === 'annual' && employee.salaryInfo.annualSalary) {
      grossPay = Number(employee.salaryInfo.annualSalary) / 12;
    }

    // Default 8% holiday allowance (vakantiegeld)
    const vacationAccrual = (8 / 100) * grossPay;
    const taxes = calculateTaxes(grossPay, employee);
    const netPay = grossPay - taxes.incomeTax - taxes.socialSecurityEmployee - taxes.pensionEmployee;

    return {
      employeeId: employee.id,
      companyId: employee.companyId,
      payrollPeriodId: '',
      periodStartDate,
      periodEndDate,
      regularHours: 0,
      regularRate: 0,
      regularPay: grossPay,
      overtimeHours: 0,
      overtimeRate: 0,
      overtimePay: 0,
      eveningHours: 0,
      eveningRate: 0,
      eveningPay: 0,
      nightHours: 0,
      nightRate: 0,
      nightPay: 0,
      weekendHours: 0,
      weekendRate: 0,
      weekendPay: 0,
      holidayHours: 0,
      holidayRate: 0,
      holidayPay: 0,
      travelKilometers: 0,
      travelRate: 0,
      travelAllowance: 0,
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
  }

  // For hourly employees, calculate based on timesheets
  // Filter entries to only include those within the payroll period
  const entriesInPeriod = timesheets.flatMap(ts =>
    ts.entries.filter(entry =>
      entry.date >= periodStartDate && entry.date <= periodEndDate
    )
  );

  const totalHours = entriesInPeriod.reduce((acc, entry) => ({
    regular: acc.regular + entry.regularHours,
    overtime: acc.overtime + entry.overtimeHours,
    evening: acc.evening + entry.eveningHours,
    night: acc.night + entry.nightHours,
    weekend: acc.weekend + entry.weekendHours,
    travel: acc.travel + entry.travelKilometers
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

  const travelRate = employee.salaryInfo.travelAllowancePerKm || 0.23;
  const travelAllowance = totalHours.travel * travelRate;

  const grossPay = regularPay + overtimePay + eveningPay + nightPay + weekendPay;

  // Default 8% holiday allowance (vakantiegeld)
  const vacationAccrual = (8 / 100) * grossPay;

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
  // ===== STAP 1: Bereken pensioengrondslag en pensioenpremie =====
  // Franchise 2025: €15.927 per jaar = €1.327,25 per maand
  const franchisePerMonth = 15927 / 12; // €1.327,25
  const pensionableSalary = Math.max(0, grossPay - franchisePerMonth);

  // Pensioenpremie (meestal 10-15% voor werknemer, hoger voor werkgever)
  const pensionRateEmployee = 0.1028; // 10,28%
  const pensionRateEmployer = 0.1542; // 15,42%
  const pensionEmployee = pensionableSalary * pensionRateEmployee;
  const pensionEmployer = pensionableSalary * pensionRateEmployer;

  // ===== STAP 2: Werknemersverzekeringen (betaald door werknemer) =====
  // WW (Werkloosheidswet) - sector afhankelijk, ca. 0,26%
  const wwRate = 0.0026; // 0,26%
  const wwPremium = grossPay * wwRate;

  // WGA (Werk en Inkomen naar Arbeidsvermogen) - sector afhankelijk, ca. 0,38%
  const wgaRate = 0.0038; // 0,38%
  const wgaPremium = grossPay * wgaRate;

  const werknemersVerzekeringen = wwPremium + wgaPremium;

  // ===== STAP 3: Loonheffing met Nederlandse tariefschijven 2025 =====
  // Bereken jaarinkomen voor tabel
  const yearlyGross = grossPay * 12;

  let yearlyTax = 0;

  // Tariefschijf 1: €0 - €38.441 → 36,97%
  // Tariefschijf 2: €38.441 - €75.624 → 36,97%
  // Tariefschijf 3: >€75.624 → 49,50%

  if (yearlyGross <= 38441) {
    yearlyTax = yearlyGross * 0.3697;
  } else if (yearlyGross <= 75624) {
    yearlyTax = (38441 * 0.3697) + ((yearlyGross - 38441) * 0.3697);
  } else {
    yearlyTax = (38441 * 0.3697) + ((75624 - 38441) * 0.3697) + ((yearlyGross - 75624) * 0.4950);
  }

  // Heffingskortingen 2025 (alleen bij witte tabel + taxCredit)
  let yearlyTaxCredit = 0;
  if (employee.salaryInfo.taxCredit && employee.salaryInfo.taxTable === 'white') {
    // Algemene heffingskorting 2025: max €3.362
    if (yearlyGross <= 24812) {
      yearlyTaxCredit += 3362;
    } else if (yearlyGross <= 75518) {
      yearlyTaxCredit += Math.max(0, 3362 - (0.06630 * (yearlyGross - 24812)));
    }

    // Arbeidskorting 2025: max €5.552
    if (yearlyGross >= 11491 && yearlyGross <= 24820) {
      const arbeidskorting = 0.3192 * (yearlyGross - 11491);
      yearlyTaxCredit += Math.min(5552, arbeidskorting);
    } else if (yearlyGross > 24820 && yearlyGross <= 39958) {
      yearlyTaxCredit += 5552 - (0.06510 * (yearlyGross - 24820));
    } else if (yearlyGross > 39958 && yearlyGross <= 125250) {
      yearlyTaxCredit += Math.max(0, 4567 - (0.06510 * (yearlyGross - 39958)));
    }
  }

  // Netto loonheffing per maand
  const monthlyTax = Math.max(0, (yearlyTax - yearlyTaxCredit) / 12);

  return {
    incomeTax: monthlyTax,
    socialSecurityEmployee: werknemersVerzekeringen,
    socialSecurityEmployer: werknemersVerzekeringen,
    healthInsurance: 0, // CAK moet apart ingesteld worden als deduction
    pensionEmployee: pensionEmployee,
    pensionEmployer: pensionEmployer,
    unemploymentInsurance: wwPremium,
    disabilityInsurance: wgaPremium
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