import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, setDoc } from 'firebase/firestore';

const CLIENT_ID = '896567545879-t7ps2toen24v8nrjn5ulf59esnjg1hok.apps.googleusercontent.com';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Save Google Drive token to Firestore
 */
export const saveGoogleDriveToken = async (userId: string, token: string, expiresIn: number) => {
  try {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    await setDoc(doc(db, 'userGoogleDriveTokens', userId), {
      token,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.fromDate(new Date()),
    }, { merge: true });
  } catch (error) {
    console.error('Error saving token:', error);
    throw new Error('Kon token niet opslaan');
  }
};

/**
 * Get Google Drive token from Firestore
 */
export const getGoogleDriveToken = async (userId: string): Promise<string | null> => {
  try {
    const docSnap = await getDocs(query(
      collection(db, 'userGoogleDriveTokens'),
      where('__name__', '==', userId)
    ));

    if (docSnap.empty) return null;

    const data = docSnap.docs[0].data();
    const expiresAt = data.expiresAt.toDate();

    // Check if token is expired
    if (new Date() > expiresAt) {
      return null; // Token expired, need to re-auth
    }

    return data.token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

/**
 * Request Google Drive access - with Settings flow
 */
export const requestGoogleDriveAccessForSettings = async (): Promise<string> => {
  const redirectUri = window.location.origin;
  const state = Math.random().toString(36).substring(7);

  sessionStorage.setItem('google_oauth_state', state);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('scope', SCOPES.join(' '));
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('prompt', 'consent');
  authUrl.searchParams.append('access_type', 'offline');

  const popup = window.open(authUrl.toString(), 'google_auth', 'width=500,height=600');

  if (!popup) {
    throw new Error('Popup blocked - allow popups for Google Drive access');
  }

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'GOOGLE_AUTH_TOKEN') {
        window.removeEventListener('message', handleMessage);
        popup?.close();
        resolve(event.data.token);
      }
    };

    window.addEventListener('message', handleMessage);

    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      popup?.close();
      reject(new Error('Google Drive auth timeout'));
    }, 600000);
  });
};

/**
 * Create or get folder in Google Drive
 */
export const createOrGetFolder = async (folderName: string, token: string, parentFolderId?: string): Promise<string> => {
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
  token: string,
  fileName?: string
): Promise<{
  fileId: string;
  webViewLink: string;
  downloadLink: string;
  name: string;
}> => {
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
      fileUrl: driveWebLink,
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
 * Get or create company Drive folder structure
 */
export const getOrCreateCompanyDriveFolder = async (
  companyId: string,
  companyName: string,
  token: string
): Promise<{
  rootFolderId: string;
  incomingInvoicesFolderId: string;
  outgoingInvoicesFolderId: string;
}> => {
  try {
    // Create main root folder "Alloon"
    const rootFolderId = await createOrGetFolder('Alloon', token);

    // Create company folder
    const companyFolderId = await createOrGetFolder(
      companyName,
      token,
      rootFolderId
    );

    // Create subfolders
    const incomingInvoicesFolderId = await createOrGetFolder(
      'Inkomende Facturen',
      token,
      companyFolderId
    );

    const outgoingInvoicesFolderId = await createOrGetFolder(
      'Uitgaande Facturen',
      token,
      companyFolderId
    );

    await createOrGetFolder('Exports', token, companyFolderId);

    // Store folder structure in Firestore
    await setDoc(doc(db, 'driveFolderStructure', `${companyId}`), {
      companyId,
      companyName,
      rootFolderId,
      companyFolderId,
      incomingInvoicesFolderId,
      outgoingInvoicesFolderId,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    });

    return {
      rootFolderId,
      incomingInvoicesFolderId,
      outgoingInvoicesFolderId,
    };
  } catch (error) {
    console.error('Error creating folder structure:', error);
    throw new Error('Kon mapstructuur niet aanmaken');
  }
};

/**
 * Get existing company folder structure
 */
export const getCompanyDriveFolders = async (companyId: string) => {
  try {
    const docSnap = await getDocs(query(
      collection(db, 'driveFolderStructure'),
      where('companyId', '==', companyId)
    ));

    if (docSnap.empty) return null;
    return docSnap.docs[0].data();
  } catch (error) {
    console.error('Error getting folder structure:', error);
    return null;
  }
};

/**
 * Upload invoice to Drive
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
    // Get token from Firestore
    const token = await getGoogleDriveToken(userId);
    if (!token) {
      throw new Error('Google Drive not connected. Please connect in Settings.');
    }

    // Get or create folder structure
    let folders = await getCompanyDriveFolders(companyId);
    if (!folders) {
      folders = await getOrCreateCompanyDriveFolder(companyId, companyName, token);
    }

    // Upload file to Drive
    const uploadResult = await uploadFileToDrive(
      file,
      folders.incomingInvoicesFolderId,
      token,
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