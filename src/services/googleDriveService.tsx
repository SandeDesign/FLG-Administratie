import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc } from 'firebase/firestore';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '896567545879-rr9ggafhleoid5vcokd1mb2vquuk9jdd.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
let tokenClient: any = null;
let accessToken: string | null = null;

/**
 * Initialize Google Drive API
 */
export const initGoogleDrive = async () => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // @ts-ignore
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: (response: any) => {
          if (response.access_token) {
            accessToken = response.access_token;
            resolve(true);
          } else {
            reject(new Error('Failed to get access token'));
          }
        },
      });
      resolve(true);
    };
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.body.appendChild(script);
  });
};

/**
 * Request access token from user
 */
export const requestGoogleDriveAccess = async () => {
  if (!tokenClient) {
    await initGoogleDrive();
  }
  
  if (accessToken) {
    return accessToken;
  }

  return new Promise((resolve, reject) => {
    tokenClient.requestAccessToken({ prompt: 'consent' });
    
    // Wait for token callback
    const checkToken = setInterval(() => {
      if (accessToken) {
        clearInterval(checkToken);
        resolve(accessToken);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkToken);
      reject(new Error('Token request timeout'));
    }, 30000);
  });
};

/**
 * Create or get folder in Google Drive
 */
export const createOrGetFolder = async (folderName: string, parentFolderId?: string): Promise<string> => {
  const token = await requestGoogleDriveAccess();

  // Search for existing folder
  const query_str = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${
    parentFolderId ? ` and '${parentFolderId}' in parents` : ''
  }`;

  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query_str)}&spaces=drive&pageSize=10&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const searchData = await searchResponse.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder if not found
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId && { parents: [parentFolderId] }),
  };

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  const createData = await createResponse.json();

  if (!createData.id) {
    throw new Error('Failed to create folder');
  }

  return createData.id;
};

/**
 * Upload file to Google Drive
 */
export const uploadFileToDrive = async (
  file: File,
  folderId: string,
  fileName?: string
): Promise<{
  fileId: string;
  webViewLink: string;
  downloadLink: string;
  name: string;
}> => {
  const token = await requestGoogleDriveAccess();

  const formData = new FormData();

  const metadata = {
    name: fileName || file.name,
    parents: [folderId],
  };

  formData.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  formData.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
    downloadLink: `https://drive.google.com/file/d/${data.id}/view`,
    name: data.name,
  };
};

/**
 * Save invoice metadata to Firestore with Drive reference
 */
export const saveInvoiceWithDriveFile = async (
  invoiceData: any,
  driveFileId: string,
  driveWebLink: string,
  userId: string,
  companyId: string
): Promise<string> => {
  try {
    const now = new Date();
    const docData = {
      ...invoiceData,
      userId,
      companyId,
      driveFileId,
      driveWebLink,
      fileUrl: driveWebLink, // For compatibility
      status: 'pending',
      invoiceDate: Timestamp.fromDate(invoiceData.invoiceDate || now),
      dueDate: Timestamp.fromDate(invoiceData.dueDate || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      ocrProcessed: false,
    };

    const docRef = await addDoc(collection(db, 'incomingInvoices'), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving invoice:', error);
    throw new Error('Kon factuur niet opslaan');
  }
};

/**
 * Get Drive folder ID for company (create if not exists)
 */
export const getOrCreateCompanyDriveFolder = async (
  companyId: string,
  companyName: string,
  userId: string
): Promise<string> => {
  try {
    // Check if folder ID is already stored in Firestore
    const q = query(
      collection(db, 'driveFolders'),
      where('companyId', '==', companyId),
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.docs.length > 0) {
      return querySnapshot.docs[0].data().folderId;
    }

    // Create main company folder
    const companyFolderId = await createOrGetFolder(`${companyName} - Documenten`);

    // Create subfolder for incoming invoices
    const invoicesFolderId = await createOrGetFolder(
      'Inkomende Facturen',
      companyFolderId
    );

    // Store folder reference in Firestore
    await addDoc(collection(db, 'driveFolders'), {
      companyId,
      userId,
      companyFolderId,
      invoicesFolderId,
      createdAt: Timestamp.fromDate(new Date()),
    });

    return invoicesFolderId;
  } catch (error) {
    console.error('Error getting/creating company folder:', error);
    throw new Error('Kon Drive map niet aanmaken');
  }
};

/**
 * Upload invoice directly to Drive
 */
export const uploadInvoiceToDrive = async (
  file: File,
  companyId: string,
  companyName: string,
  userId: string,
  metadata?: {
    supplierName?: string;
    invoiceNumber?: string;
    amount?: number;
  }
): Promise<{
  invoiceId: string;
  driveFileId: string;
  driveWebLink: string;
}> => {
  try {
    // Get or create company Drive folder
    const invoicesFolderId = await getOrCreateCompanyDriveFolder(
      companyId,
      companyName,
      userId
    );

    // Upload file to Drive
    const uploadResult = await uploadFileToDrive(
      file,
      invoicesFolderId,
      `${metadata?.invoiceNumber || 'INV'}-${Date.now()}.pdf`
    );

    // Save invoice record to Firestore with Drive reference
    const invoiceId = await saveInvoiceWithDriveFile(
      {
        supplierName: metadata?.supplierName || 'Onbekend',
        invoiceNumber: metadata?.invoiceNumber || `INV-${Date.now()}`,
        amount: metadata?.amount || 0,
        fileName: file.name,
      },
      uploadResult.fileId,
      uploadResult.webViewLink,
      userId,
      companyId
    );

    return {
      invoiceId,
      driveFileId: uploadResult.fileId,
      driveWebLink: uploadResult.webViewLink,
    };
  } catch (error) {
    console.error('Error uploading invoice to Drive:', error);
    throw error;
  }
};