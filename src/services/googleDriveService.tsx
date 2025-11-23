import { db } from '../lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

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
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);
  formData.append('companyName', companyName);
  formData.append('folderType', 'Inkoop');

  const response = await fetch('/api/upload-to-drive', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }

  const result = await response.json();

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
    driveFileId: result.driveFileId,
    driveWebLink: result.driveWebLink,
    ocrData: ocrData || null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  });

  return {
    invoiceId: docRef.id,
    driveFileId: result.driveFileId,
    driveWebLink: result.driveWebLink,
  };
};

export const checkDriveConnection = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const res = await fetch('/api/upload-to-drive', { method: 'OPTIONS' });
    return { connected: res.ok, message: res.ok ? 'Verbonden' : 'Niet verbonden' };
  } catch {
    return { connected: false, message: 'Fout bij verbinden' };
  }
};

// Legacy exports for backwards compatibility
export const requestGoogleDriveToken = async () => 'service-account';
export const saveGoogleDriveToken = async () => {};
export const getGoogleDriveToken = async () => 'service-account';
export const silentRefreshGoogleToken = async () => 'service-account';
