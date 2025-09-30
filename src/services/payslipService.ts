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
import { Payslip, PayslipData } from '../types/payslip';
import { PayrollCalculation } from '../types/payroll';
import { Employee, Company } from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  const dateFields = [
    'periodStartDate', 'periodEndDate', 'paymentDate',
    'generatedAt', 'emailedAt', 'downloadedAt', 'createdAt', 'updatedAt'
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
    'periodStartDate', 'periodEndDate', 'paymentDate',
    'generatedAt', 'emailedAt', 'downloadedAt', 'createdAt', 'updatedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field] instanceof Date) {
      converted[field] = Timestamp.fromDate(converted[field]);
    }
  });

  return converted;
};

export const getPayslips = async (
  userId: string,
  employeeId?: string,
  payrollPeriodId?: string
): Promise<Payslip[]> => {
  let q = query(
    collection(db, 'payslips'),
    where('userId', '==', userId),
    orderBy('periodStartDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  let payslips = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as Payslip));

  if (employeeId) {
    payslips = payslips.filter(p => p.employeeId === employeeId);
  }

  if (payrollPeriodId) {
    payslips = payslips.filter(p => p.payrollPeriodId === payrollPeriodId);
  }

  return payslips;
};

export const getPayslip = async (id: string, userId: string): Promise<Payslip | null> => {
  const docRef = doc(db, 'payslips', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  if (data.userId !== userId) {
    throw new Error('Unauthorized');
  }

  return {
    id: docSnap.id,
    ...convertTimestamps(data)
  } as Payslip;
};

export const createPayslip = async (
  userId: string,
  payslip: Omit<Payslip, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const payslipData = convertToTimestamps({
    ...payslip,
    userId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const docRef = await addDoc(collection(db, 'payslips'), payslipData);
  return docRef.id;
};

export const generatePayslipData = async (
  company: Company,
  employee: Employee,
  calculation: PayrollCalculation
): Promise<PayslipData> => {
  const earnings = [
    {
      description: 'Normale uren',
      quantity: calculation.regularHours,
      rate: calculation.regularRate,
      amount: calculation.regularPay,
      ytdAmount: 0
    },
    {
      description: 'Overuren',
      quantity: calculation.overtimeHours,
      rate: calculation.overtimeRate,
      amount: calculation.overtimePay,
      ytdAmount: 0
    },
    {
      description: 'Avonduren',
      quantity: calculation.eveningHours,
      rate: calculation.eveningRate,
      amount: calculation.eveningPay,
      ytdAmount: 0
    },
    {
      description: 'Nachturen',
      quantity: calculation.nightHours,
      rate: calculation.nightRate,
      amount: calculation.nightPay,
      ytdAmount: 0
    },
    {
      description: 'Weekenduren',
      quantity: calculation.weekendHours,
      rate: calculation.weekendRate,
      amount: calculation.weekendPay,
      ytdAmount: 0
    },
    {
      description: 'Reiskostenvergoeding',
      quantity: calculation.travelKilometers,
      rate: calculation.travelRate,
      amount: calculation.travelAllowance,
      ytdAmount: 0
    }
  ].filter(e => e.amount > 0);

  const deductions = calculation.deductions.map(d => ({
    description: d.description,
    amount: d.amount,
    ytdAmount: 0
  }));

  const taxes = [
    {
      description: 'Loonheffing',
      amount: calculation.taxes.incomeTax,
      ytdAmount: 0
    },
    {
      description: 'Werknemersverzekeringen',
      amount: calculation.taxes.socialSecurityEmployee,
      ytdAmount: 0
    },
    {
      description: 'Pensioenpremie werknemer',
      amount: calculation.taxes.pensionEmployee,
      ytdAmount: 0
    }
  ];

  return {
    company: {
      name: company.name,
      address: company.address.street,
      postalCode: company.address.zipCode,
      city: company.address.city,
      country: company.address.country,
      kvkNumber: company.kvk,
      taxNumber: company.taxNumber,
      logo: company.logoUrl
    },
    employee: {
      name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
      address: `${employee.personalInfo.address.street} ${employee.personalInfo.address.houseNumber}`,
      postalCode: employee.personalInfo.address.postalCode,
      city: employee.personalInfo.address.city,
      bsn: employee.personalInfo.bsn,
      taxNumber: employee.salaryInfo.taxTable,
      employeeNumber: employee.id,
      jobTitle: employee.contractInfo.position
    },
    period: {
      startDate: calculation.periodStartDate,
      endDate: calculation.periodEndDate,
      paymentDate: calculation.periodEndDate,
      payrollNumber: calculation.id || ''
    },
    earnings,
    deductions,
    taxes,
    summary: {
      grossPay: calculation.grossPay,
      totalDeductions: deductions.reduce((sum, d) => sum + d.amount, 0),
      totalTaxes: taxes.reduce((sum, t) => sum + t.amount, 0),
      netPay: calculation.netPay,
      ytdGross: calculation.ytdGross,
      ytdDeductions: 0,
      ytdTaxes: calculation.ytdTax,
      ytdNet: calculation.ytdNet
    },
    leave: {
      vacationDaysAccrued: employee.leaveInfo.holidayDays.accumulated,
      vacationDaysUsed: employee.leaveInfo.holidayDays.taken,
      vacationDaysBalance: employee.leaveInfo.holidayDays.remaining
    },
    pension: {
      employeeContribution: calculation.taxes.pensionEmployee,
      employerContribution: calculation.taxes.pensionEmployer,
      ytdEmployeeContribution: 0,
      ytdEmployerContribution: 0
    }
  };
};

export const markPayslipAsDownloaded = async (id: string, userId: string): Promise<void> => {
  const docRef = doc(db, 'payslips', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists() || docSnap.data().userId !== userId) {
    throw new Error('Unauthorized');
  }

  await updateDoc(docRef, {
    downloadedAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date())
  });
};
