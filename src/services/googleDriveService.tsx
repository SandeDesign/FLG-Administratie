import { db } from '../lib/firebase';
import { addDoc, collection, Timestamp, doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { uploadFile } from './fileUploadService';

/**
 * Generate a unique reference number for incoming invoices
 * Format: INK-YYYY-####
 */
async function generateIncomingInvoiceReference(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'companies', companyId, 'counters', 'incomingInvoices');

  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let currentNumber = 1;
    let currentYear = year;

    if (counterDoc.exists()) {
      const data = counterDoc.data();
      currentYear = data.year || year;
      currentNumber = data.number || 1;

      // Reset counter if new year
      if (currentYear !== year) {
        currentYear = year;
        currentNumber = 1;
      }
    }

    // Update counter
    transaction.set(counterRef, {
      year: currentYear,
      number: currentNumber + 1,
      lastUpdated: Timestamp.now()
    });

    // Return formatted reference: INK-2025-0001
    return `INK-${year}-${String(currentNumber).padStart(4, '0')}`;
  });
}

export const uploadInvoiceToDrive = async (
  file: File,
  companyId: string,
  companyName: string,
  userId: string,
  _userEmail?: string,
  metadata?: {
    supplierName?: string;
    invoiceNumber?: string;
    amount?: number;
    vatAmount?: number;
    totalAmount?: number;
  },
  ocrData?: any
): Promise<{ invoiceId: string; driveFileId: string; driveWebLink: string }> => {
  // ✅ Generate unique reference number FIRST
  const referenceNumber = await generateIncomingInvoiceReference(companyId);

  // ✅ Upload to internedata.nl with reference number as filename
  const uploadResult = await uploadFile(file, companyName, 'Inkoop', referenceNumber);

  // Save to Firestore
  const now = new Date();
  const supplierInvoiceNumber = ocrData?.invoiceNumber || metadata?.invoiceNumber || '';

  const docRef = await addDoc(collection(db, 'incomingInvoices'), {
    userId,
    companyId,
    referenceNumber, // ✅ Our own unique reference
    supplierName: ocrData?.supplierName || metadata?.supplierName || 'Onbekend',
    supplierInvoiceNumber, // ✅ Leverancier's factuurnummer (apart veld)
    invoiceNumber: referenceNumber, // ✅ Use our reference as main invoice number
    fileName: `${referenceNumber}.${file.name.split('.').pop()}`, // ✅ Consistent filename
    subtotal: ocrData?.subtotal || metadata?.amount || 0,
    vatAmount: ocrData?.vatAmount || metadata?.vatAmount || 0,
    totalAmount: ocrData?.totalInclVat || metadata?.totalAmount || 0,
    invoiceDate: Timestamp.fromDate(ocrData?.invoiceDate || now),
    dueDate: Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
    status: 'pending',
    fileUrl: uploadResult.fileUrl,
    ocrData: ocrData || null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return {
    invoiceId: docRef.id,
    driveFileId: 'external',
    driveWebLink: uploadResult.fileUrl,
  };
};

export const checkDriveConnection = async (): Promise<{ connected: boolean; message: string }> => {
  return { connected: true, message: 'Verbonden met internedata.nl' };
};

// Legacy exports
export const requestGoogleDriveToken = async () => 'not-needed';
export const saveGoogleDriveToken = async () => {};
export const getGoogleDriveToken = async () => 'not-needed';
export const silentRefreshGoogleToken = async () => 'not-needed';
