import { auth, db } from '../lib/firebase';
import { doc, addDoc, collection, Timestamp } from 'firebase/firestore';

/**
 * Upload a file to Google Drive via Netlify Edge Function
 * Uses Service Account - no per-user OAuth needed!
 */
export const uploadInvoiceToDrive = async (
  file: File,
  companyId: string,
  companyName: string,
  userId: string,
  userEmail?: string,
  metadata?: {
    supplierName?: string;
    invoiceNumber?: string;
    amount?: number;
    vatAmount?: number;
    totalAmount?: number;
  },
  ocrData?: any
): Promise<{
  invoiceId: string;
  driveFileId: string;
  driveWebLink: string;
}> => {
  try {
    console.log(`Uploading: ${file.name} for ${companyName}`);

    // Prepare form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);
    formData.append('companyName', companyName);
    formData.append('folderType', 'Inkoop');
    formData.append('metadata', JSON.stringify({
      supplierName: ocrData?.supplierName || metadata?.supplierName || 'Onbekend',
      invoiceNumber: ocrData?.invoiceNumber || metadata?.invoiceNumber || `INV-${Date.now()}`,
      subtotal: ocrData?.subtotal || metadata?.amount || 0,
      vatAmount: ocrData?.vatAmount || metadata?.vatAmount || 0,
      totalAmount: ocrData?.totalInclVat || metadata?.totalAmount || 0,
      ocrConfidence: ocrData?.confidence || 0,
    }));

    // Call Netlify Edge Function
    const response = await fetch('/api/upload-to-drive', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.message || errorData.error || 'Upload failed');
    }

    const result = await response.json();
    console.log(`✓ Drive upload complete: ${result.driveWebLink}`);

    // Save to Firestore
    const now = new Date();
    const invoiceData = {
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
      ocrConfidence: ocrData?.confidence || 0,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    };

    const docRef = await addDoc(collection(db, 'incomingInvoices'), invoiceData);
    console.log(`✓ Saved to Firestore: ${docRef.id}`);

    return {
      invoiceId: docRef.id,
      driveFileId: result.driveFileId,
      driveWebLink: result.driveWebLink,
    };

  } catch (error) {
    console.error('Error uploading invoice to Drive:', error);
    throw error;
  }
};

/**
 * Check if Google Drive connection is working
 */
export const checkDriveConnection = async (): Promise<{
  connected: boolean;
  message: string;
}> => {
  try {
    // Simple health check - try to call the function
    const response = await fetch('/api/upload-to-drive', {
      method: 'OPTIONS',
    });

    return {
      connected: response.ok,
      message: response.ok ? 'Google Drive verbonden via Service Account' : 'Verbinding niet beschikbaar',
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Kon geen verbinding maken',
    };
  }
};

// ============================================
// LEGACY FUNCTIONS - Kept for backward compatibility
// ============================================

/** @deprecated No longer needed - Service Account handles auth */
export const requestGoogleDriveToken = async (userEmail?: string): Promise<string> => {
  console.warn('requestGoogleDriveToken is deprecated - using Service Account');
  return 'service-account-token';
};

/** @deprecated No longer needed - Service Account handles auth */
export const silentRefreshGoogleToken = async (userId: string, userEmail?: string): Promise<string | null> => {
  console.warn('silentRefreshGoogleToken is deprecated - using Service Account');
  return 'service-account-token';
};

/** @deprecated No longer needed - Service Account handles auth */
export const saveGoogleDriveToken = async (userId: string, token: string) => {
  console.warn('saveGoogleDriveToken is deprecated - using Service Account');
};

/** @deprecated No longer needed - Service Account handles auth */
export const getGoogleDriveToken = async (userId: string): Promise<string | null> => {
  console.warn('getGoogleDriveToken is deprecated - using Service Account');
  return 'service-account-token';
};

/** @deprecated Use uploadInvoiceToDrive instead */
export const findOrCreateFolder = async (
  folderName: string,
  token: string,
  parentFolderId?: string
): Promise<string> => {
  console.warn('findOrCreateFolder is deprecated - handled by edge function');
  return 'handled-by-edge-function';
};

/** @deprecated Use uploadInvoiceToDrive instead */
export const uploadFileToDrive = async (
  file: File,
  folderId: string,
  token: string,
  fileName?: string
): Promise<{
  fileId: string;
  webViewLink: string;
  downloadLink: string;
  name: string;
}> => {
  console.warn('uploadFileToDrive is deprecated - use uploadInvoiceToDrive');
  throw new Error('Use uploadInvoiceToDrive instead');
};
