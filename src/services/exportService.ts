import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ExportJob, ExportType, SEPAPayment, AccountingExport, PensionExport } from '../types/export';
import { PayrollCalculation } from '../types/payroll';
import { Employee } from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  const dateFields = [
    'requestedAt', 'completedAt', 'downloadedAt', 'expiresAt',
    'createdAt', 'updatedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field] && typeof converted[field].toDate === 'function') {
      converted[field] = converted[field].toDate();
    }
  });

  if (converted.filters) {
    if (converted.filters.startDate && typeof converted.filters.startDate.toDate === 'function') {
      converted.filters.startDate = converted.filters.startDate.toDate();
    }
    if (converted.filters.endDate && typeof converted.filters.endDate.toDate === 'function') {
      converted.filters.endDate = converted.filters.endDate.toDate();
    }
  }

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  const dateFields = [
    'requestedAt', 'completedAt', 'downloadedAt', 'expiresAt',
    'createdAt', 'updatedAt'
  ];

  dateFields.forEach(field => {
    if (converted[field] instanceof Date) {
      converted[field] = Timestamp.fromDate(converted[field]);
    }
  });

  if (converted.filters) {
    if (converted.filters.startDate instanceof Date) {
      converted.filters.startDate = Timestamp.fromDate(converted.filters.startDate);
    }
    if (converted.filters.endDate instanceof Date) {
      converted.filters.endDate = Timestamp.fromDate(converted.filters.endDate);
    }
  }

  return converted;
};

export const getExportJobs = async (userId: string, companyId: string): Promise<ExportJob[]> => {
  const q = query(
    collection(db, 'exportJobs'),
    where('userId', '==', userId),
    where('companyId', '==', companyId),
    orderBy('requestedAt', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  } as ExportJob));
};

export const createExportJob = async (
  userId: string,
  companyId: string,
  exportType: ExportType,
  filters: ExportJob['filters'],
  requestedBy: string
): Promise<string> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const exportJob = convertToTimestamps({
    userId,
    companyId,
    exportType,
    status: 'pending',
    filters,
    fileName: `${exportType}_${now.getTime()}.csv`,
    recordCount: 0,
    requestedAt: now,
    requestedBy,
    expiresAt,
    createdAt: now,
    updatedAt: now
  });

  const docRef = await addDoc(collection(db, 'exportJobs'), exportJob);
  return docRef.id;
};

export const updateExportJob = async (
  id: string,
  updates: Partial<ExportJob>
): Promise<void> => {
  const docRef = doc(db, 'exportJobs', id);

  const updateData = convertToTimestamps({
    ...updates,
    updatedAt: new Date()
  });

  await updateDoc(docRef, updateData);
};

export const generateTimesheetCSV = (data: any[]): string => {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Date',
    'Regular Hours',
    'Overtime Hours',
    'Evening Hours',
    'Night Hours',
    'Weekend Hours',
    'Travel KM',
    'Status'
  ];

  const rows = data.map(row => [
    row.employeeId,
    row.employeeName,
    row.date,
    row.regularHours,
    row.overtimeHours,
    row.eveningHours,
    row.nightHours,
    row.weekendHours,
    row.travelKilometers,
    row.status
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

export const generatePayrollExcel = (calculations: PayrollCalculation[]): string => {
  const headers = [
    'Employee ID',
    'Period Start',
    'Period End',
    'Regular Hours',
    'Regular Pay',
    'Overtime Hours',
    'Overtime Pay',
    'Gross Pay',
    'Income Tax',
    'Social Security',
    'Pension',
    'Net Pay'
  ];

  const rows = calculations.map(calc => [
    calc.employeeId,
    calc.periodStartDate.toISOString().split('T'),
    calc.periodEndDate.toISOString().split('T'),
    calc.regularHours,
    calc.regularPay,
    calc.overtimeHours,
    calc.overtimePay,
    calc.grossPay,
    calc.taxes.incomeTax,
    calc.taxes.socialSecurityEmployee,
    calc.taxes.pensionEmployee,
    calc.netPay
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

export const generateSEPAPaymentXML = (payment: SEPAPayment): string => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${payment.messageId}</MsgId>
      <CreDtTm>${payment.creationDate.toISOString()}</CreDtTm>
      <NbOfTxs>${payment.paymentCount}</NbOfTxs>
      <CtrlSum>${payment.totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>${payment.companyName}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${Date.now()}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>${payment.executionDate.toISOString().split('T')[0]}</ReqdExctnDt>
      <Dbtr>
        <Nm>${payment.companyName}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${payment.companyIBAN}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${payment.companyBIC}</BIC>
        </FinInstnId>
      </DbtrAgt>
      ${payment.payments.map((p, index) => `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${p.endToEndId}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${p.amount.toFixed(2)}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${p.employeeName}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${p.employeeIBAN}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${p.description}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
      `).join('')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return xml;
};

export const generateAccountingExport = (calculations: PayrollCalculation[]): AccountingExport => {
  const journalEntries = calculations.flatMap(calc => [
    {
      date: calc.periodEndDate,
      description: `Loonkosten ${calc.employeeId}`,
      debitAccount: '4000',
      creditAccount: '1600',
      amount: calc.grossPay,
      costCenter: calc.companyId,
      project: '',
      reference: calc.id || ''
    },
    {
      date: calc.periodEndDate,
      description: `Loonheffing ${calc.employeeId}`,
      debitAccount: '1600',
      creditAccount: '1601',
      amount: calc.taxes.incomeTax,
      costCenter: calc.companyId,
      project: '',
      reference: calc.id || ''
    },
    {
      date: calc.periodEndDate,
      description: `Netto uitbetaling ${calc.employeeId}`,
      debitAccount: '1600',
      creditAccount: '1100',
      amount: calc.netPay,
      costCenter: calc.companyId,
      project: '',
      reference: calc.id || ''
    }
  ]);

  const totalDebits = journalEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalCredits = journalEntries.reduce((sum, entry) => sum + entry.amount, 0); // Should be equal to totalDebits in double-entry

  return {
    journalEntries,
    totals: {
      totalDebits,
      totalCredits
    }
  };
};