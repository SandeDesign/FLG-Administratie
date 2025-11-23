import { db } from '../lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { uploadFile } from './fileUploadService';

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
  // Upload to internedata.nl
  const uploadResult = await uploadFile(file, companyName, 'Inkoop');

  // Save to Firestore
  const now = new Date();
  const docRef = await addDoc(collection(db, 'incomingInvoices'), {
    userId,
    companyId,
    supplierName: ocrData?.supplierName || metadata?.supplierName || 'Onbekend',
    invoiceNumber: ocrData?.invoiceNumber || metadata?.invoiceNumber || `INV-${Date.now()}`,
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
