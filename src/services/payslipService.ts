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
import { Payslip, PayslipData, PayslipStatus } from '../types/payslip';
import { PayrollCalculation } from '../types/payroll';
import { Employee, Company } from '../types';
// Firebase Storage niet meer gebruikt — alles via uploadFileToInternedata.
import { generatePayslipPdfBlob } from './payslipPdfGenerator';

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
  payrollPeriodId?: string,
  /**
   * Alleen loonstroken met deze status(sen) meegeven. Default: alle.
   * Voor werknemer-self-service: geef ['approved', 'paid'] mee zodat
   * draft-loonstroken (boekhouder heeft geüpload, nog niet goedgekeurd)
   * niet lekken.
   */
  statusFilter?: PayslipStatus[]
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

  if (statusFilter && statusFilter.length > 0) {
    payslips = payslips.filter(p => {
      const s = p.status || 'approved'; // legacy docs zonder status gelden als approved
      return statusFilter.includes(s);
    });
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

  console.log('🔥 FIREBASE WRITE - Collection: payslips');
  console.log('📦 FULL DATA:', JSON.stringify(payslipData, null, 2));

  const docRef = await addDoc(collection(db, 'payslips'), payslipData);

  console.log('✅ SAVED - ID:', docRef.id);

  return docRef.id;
};

export const generateAndUploadPayslipPdf = async (
  payslipData: PayslipData,
  payslipId: string,
  _userId: string,
  ctx?: {
    companyId?: string;
    companyName?: string;
    employeeCode?: string;
    periodStartDate?: Date;
  }
): Promise<string> => {
  try {
    const pdfBlob = await generatePayslipPdfBlob(payslipData);
    const file = new File([pdfBlob], `payslip-${payslipId}.pdf`, { type: 'application/pdf' });

    // Upload via internedata.nl met de uniforme folder-structuur:
    //   FLG-Administratie/{companyId}__{slug}/Loonstroken/{year}/{employeeCode}_{yyyy-MM}.pdf
    // Voor backwards-compat: als er geen companyId/companyName in ctx zit,
    // gebruiken we een generieke filename onder Loonstroken van een
    // 'onbekend' bedrijf — dat is een legacy-codepad dat we gaandeweg
    // uitfaseren.
    const { uploadFileToInternedata, slugify } = await import('./fileUploadService');
    const periodDate = ctx?.periodStartDate || new Date();
    const yyyy = periodDate.getFullYear();
    const mm = String(periodDate.getMonth() + 1).padStart(2, '0');
    const empPart = ctx?.employeeCode ? slugify(ctx.employeeCode) : payslipId;
    const customFileName = `${empPart}_${yyyy}-${mm}`;

    const uploadResult = await uploadFileToInternedata({
      file,
      companyId: ctx?.companyId || 'onbekend',
      companyName: ctx?.companyName || 'onbekend',
      folderType: 'Loonstroken',
      year: yyyy,
      customFileName,
      extension: 'pdf',
    });

    const payslipRef = doc(db, 'payslips', payslipId);
    await updateDoc(payslipRef, {
      pdfUrl: uploadResult.fileUrl,
      pdfStoragePath: uploadResult.storagePath,
      updatedAt: Timestamp.fromDate(new Date())
    });

    return uploadResult.fileUrl;
  } catch (error) {
    console.error('Error generating payslip PDF:', error);
    throw new Error('Failed to generate payslip PDF');
  }
};

/**
 * Upload een bestaande PDF als loonstrook voor een werknemer.
 * Voor boekhouder-workflow: zij leveren maandelijks de loonstroken
 * aan (geen in-app generatie) en uploaden die per medewerker.
 *
 * adminUserId = primary admin UID (voor collection-scope)
 * generatedBy = uid van de uploader (boekhouder of admin)
 */
export const uploadPayslipForEmployee = async (params: {
  adminUserId: string;
  employeeId: string;
  companyId: string;
  companyName: string;
  /** Optioneel medewerker-code voor nette filename, anders fallback employeeId */
  employeeCode?: string;
  file: File;
  periodStartDate: Date;
  periodEndDate: Date;
  generatedBy: string;
}): Promise<string> => {
  const {
    adminUserId,
    employeeId,
    companyId,
    companyName,
    employeeCode,
    file,
    periodStartDate,
    periodEndDate,
    generatedBy,
  } = params;

  // 1) Maak payslip-doc aan in status 'draft' — zichtbaar voor
  //    admin/co-admin/boekhouder, verborgen voor werknemer tot
  //    admin/co-admin goedkeurt. paymentDate blijft leeg; admin vult
  //    dat bij approval.
  const docRef = await addDoc(collection(db, 'payslips'), convertToTimestamps({
    userId: adminUserId,
    employeeId,
    companyId,
    payrollPeriodId: '',
    payrollCalculationId: '',
    periodStartDate,
    periodEndDate,
    pdfUrl: '',
    pdfStoragePath: '',
    status: 'draft',
    generatedAt: new Date(),
    generatedBy,
    uploadedByBoekhouder: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  // 2) Upload de PDF naar internedata.nl:
  //    FLG-Administratie/{companyId}__{slug}/Loonstroken/{year}/{employeeCode}_{yyyy-MM}.pdf
  const { uploadFileToInternedata, slugify } = await import('./fileUploadService');
  const yyyy = periodStartDate.getFullYear();
  const mm = String(periodStartDate.getMonth() + 1).padStart(2, '0');
  const empPart = employeeCode ? slugify(employeeCode) : employeeId.substring(0, 10);
  const customFileName = `${empPart}_${yyyy}-${mm}`;

  const uploadResult = await uploadFileToInternedata({
    file,
    companyId,
    companyName,
    folderType: 'Loonstroken',
    year: yyyy,
    customFileName,
    extension: 'pdf',
  });

  // 3) Patch het doc met pdfUrl + pdfStoragePath.
  await updateDoc(doc(db, 'payslips', docRef.id), {
    pdfUrl: uploadResult.fileUrl,
    pdfStoragePath: uploadResult.storagePath,
    updatedAt: Timestamp.fromDate(new Date()),
  });

  return docRef.id;
};

export const createPayslipFromCalculation = async (
  userId: string,
  calculation: any,
  employee: any,
  company: any
): Promise<string> => {
  const payslipData: Omit<Payslip, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    employeeId: calculation.employeeId,
    companyId: calculation.companyId,
    payrollPeriodId: calculation.payrollPeriodId,
    payrollCalculationId: calculation.id || '',
    periodStartDate: calculation.periodStartDate,
    periodEndDate: calculation.periodEndDate,
    paymentDate: calculation.periodEndDate,
    pdfUrl: '',
    pdfStoragePath: '',
    generatedAt: new Date(),
    generatedBy: userId
  };

  const payslipId = await createPayslip(userId, payslipData);

  console.log(`📄 Payslip stored in Firestore:`, {
    payslipId,
    employeeId: calculation.employeeId,
    periodId: calculation.payrollPeriodId,
    grossPay: Number(calculation.grossPay),
    netPay: Number(calculation.netPay)
  });

  // TEMPORARILY DISABLED: PDF generation fails due to Firebase Storage CORS
  // The payslip record is created in Firestore, but PDF generation is skipped
  //
  // // Generate payslip data for PDF
  // const pdfData = await generatePayslipData(company, employee, calculation);
  //
  // // Generate and upload PDF
  // try {
  //   await generateAndUploadPayslipPdf(pdfData, payslipId, userId);
  // } catch (error) {
  //   console.error('Error generating PDF for payslip:', payslipId, error);
  //   // Continue without PDF - can be regenerated later
  // }

  return payslipId;
};

export const generatePayslipData = async (
  company: Company,
  employee: Employee,
  calculation: PayrollCalculation
): Promise<PayslipData> => {
  // Convert all values to numbers to handle Firebase string conversions
  const earnings = [
    {
      description: 'Normale uren',
      quantity: Number(calculation.regularHours) || 0,
      rate: Number(calculation.regularRate) || 0,
      amount: Number(calculation.regularPay) || 0,
      ytdAmount: 0
    },
    {
      description: 'Overuren',
      quantity: Number(calculation.overtimeHours) || 0,
      rate: Number(calculation.overtimeRate) || 0,
      amount: Number(calculation.overtimePay) || 0,
      ytdAmount: 0
    },
    {
      description: 'Avonduren',
      quantity: Number(calculation.eveningHours) || 0,
      rate: Number(calculation.eveningRate) || 0,
      amount: Number(calculation.eveningPay) || 0,
      ytdAmount: 0
    },
    {
      description: 'Nachturen',
      quantity: Number(calculation.nightHours) || 0,
      rate: Number(calculation.nightRate) || 0,
      amount: Number(calculation.nightPay) || 0,
      ytdAmount: 0
    },
    {
      description: 'Weekenduren',
      quantity: Number(calculation.weekendHours) || 0,
      rate: Number(calculation.weekendRate) || 0,
      amount: Number(calculation.weekendPay) || 0,
      ytdAmount: 0
    },
    {
      description: 'Reiskostenvergoeding',
      quantity: Number(calculation.travelKilometers) || 0,
      rate: Number(calculation.travelRate) || 0,
      amount: Number(calculation.travelAllowance) || 0,
      ytdAmount: 0
    }
  ].filter(e => e.amount > 0);

  const deductions = calculation.deductions.map(d => ({
    description: d.description,
    amount: Number(d.amount) || 0,
    ytdAmount: 0
  }));

  const taxes = [
    {
      description: 'Loonheffing',
      amount: Number(calculation.taxes.incomeTax) || 0,
      ytdAmount: 0
    },
    {
      description: 'Werknemersverzekeringen',
      amount: Number(calculation.taxes.socialSecurityEmployee) || 0,
      ytdAmount: 0
    },
    {
      description: 'Pensioenpremie werknemer',
      amount: Number(calculation.taxes.pensionEmployee) || 0,
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
      paymentDate: calculation.periodEndDate, // Assuming payment date is end of period for now
      payrollNumber: calculation.id || ''
    },
    earnings,
    deductions,
    taxes,
    summary: {
      grossPay: Number(calculation.grossPay) || 0,
      totalDeductions: deductions.reduce((sum, d) => sum + d.amount, 0),
      totalTaxes: taxes.reduce((sum, t) => sum + t.amount, 0),
      netPay: Number(calculation.netPay) || 0,
      ytdGross: Number(calculation.ytdGross) || 0,
      ytdDeductions: 0,
      ytdTaxes: Number(calculation.ytdTax) || 0,
      ytdNet: Number(calculation.ytdNet) || 0
    },
    leave: {
      vacationDaysAccrued: employee.leaveInfo?.vacation?.accrued || 0,
      vacationDaysUsed: employee.leaveInfo?.vacation?.taken || 0,
      vacationDaysBalance: employee.leaveInfo?.vacation?.remaining || 0
    },
    pension: {
      employeeContribution: Number(calculation.taxes.pensionEmployee) || 0,
      employerContribution: Number(calculation.taxes.pensionEmployer) || 0,
      ytdEmployeeContribution: 0,
      ytdEmployerContribution: 0
    }
  };
};

/**
 * Verwijder een loonstrook. Haalt ook de PDF weg (voor zover mogelijk):
 *  - legacy Firebase Storage bestanden worden ongemoeid gelaten (bucket
 *    wordt niet meer gebruikt voor nieuwe uploads); alleen het Firestore
 *    doc verdwijnt. Die bestanden op oude paden blijven nog bestaan
 *    tot handmatige opruiming.
 *  - Nieuwe uploads via internedata.nl kunnen via een PHP delete-endpoint
 *    worden opgeruimd — zodra dat endpoint er is, hier toevoegen.
 */
export const deletePayslip = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'payslips', id));
};

/**
 * Admin/co-admin keurt een loonstrook goed — zet status op 'approved'
 * en (optioneel) de paymentDate. Vanaf dit moment zichtbaar voor de
 * werknemer zelf.
 */
export const approvePayslip = async (
  id: string,
  approvedBy: string,
  paymentDate?: Date
): Promise<void> => {
  const payload: Record<string, any> = {
    status: 'approved',
    approvedAt: Timestamp.fromDate(new Date()),
    approvedBy,
    updatedAt: Timestamp.fromDate(new Date()),
  };
  if (paymentDate) {
    payload.paymentDate = Timestamp.fromDate(paymentDate);
  }
  await updateDoc(doc(db, 'payslips', id), payload);
};

/**
 * Admin/co-admin markeert loonstrook als uitbetaald.
 */
export const markPayslipPaid = async (
  id: string,
  paidBy: string,
  paymentDate?: Date
): Promise<void> => {
  const payload: Record<string, any> = {
    status: 'paid',
    paidAt: Timestamp.fromDate(new Date()),
    paidBy,
    updatedAt: Timestamp.fromDate(new Date()),
  };
  if (paymentDate) {
    payload.paymentDate = Timestamp.fromDate(paymentDate);
  }
  await updateDoc(doc(db, 'payslips', id), payload);
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

export const regeneratePayslipPdf = async (
  payslipId: string,
  userId: string,
  employee: any,
  company: any,
  calculation: any
): Promise<string> => {
  try {
    const pdfData = await generatePayslipData(company, employee, calculation);
    const downloadURL = await generateAndUploadPayslipPdf(pdfData, payslipId, userId, {
      companyId: company?.id,
      companyName: company?.name,
      employeeCode: employee?.personalInfo
        ? `${employee.personalInfo.firstName}-${employee.personalInfo.lastName}`
        : undefined,
      periodStartDate: calculation?.periodStartDate,
    });
    return downloadURL;
  } catch (error) {
    console.error('Error regenerating payslip PDF:', error);
    throw new Error('Failed to regenerate payslip PDF');
  }
};