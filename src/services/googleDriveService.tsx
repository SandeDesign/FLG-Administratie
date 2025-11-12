import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, Timestamp, addDoc, collection } from 'firebase/firestore';

const CLIENT_ID = '896567545879-t7ps2toen24v8nrjn5ulf59esnjg1hok.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let accessToken: string | null = null;

/**
 * Request Google Drive access token via OAuth2
 */
export const requestGoogleDriveToken = async (userEmail?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'token');
    authUrl.searchParams.append('scope', SCOPES.join(' '));
    authUrl.searchParams.append('prompt', 'consent');
    
    if (userEmail) {
      authUrl.searchParams.append('login_hint', userEmail);
    }

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      'google_auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('Popup blocked'));
      return;
    }

    const checkPopup = setInterval(() => {
      try {
        if (!popup.closed) {
          const popupUrl = popup.location.href;
          if (popupUrl.includes('access_token=')) {
            const urlParams = new URLSearchParams(popupUrl.split('#')[1]);
            const token = urlParams.get('access_token');
            
            if (token) {
              accessToken = token;
              clearInterval(checkPopup);
              popup.close();
              resolve(token);
            }
          }
        } else {
          clearInterval(checkPopup);
          reject(new Error('Popup closed by user'));
        }
      } catch (e) {
        // Cross-origin error, popup is on different domain (normal)
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkPopup);
      if (!popup.closed) popup.close();
      reject(new Error('Google auth timeout'));
    }, 600000);
  });
};

/**
 * Silent refresh - automatic token refresh met minimale user interaction
 */
export const silentRefreshGoogleToken = async (userId: string, userEmail?: string): Promise<string | null> => {
  try {
    const token = await getGoogleDriveToken(userId);
    
    // Token still valid
    if (token) {
      return token;
    }

    // Token expired - refresh silently
    console.log('Token expired, refreshing silently...');
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'token');
    authUrl.searchParams.append('scope', SCOPES.join(' '));
    authUrl.searchParams.append('prompt', ''); // Empty prompt = silent refresh
    
    if (userEmail) {
      authUrl.searchParams.append('login_hint', userEmail);
    }

    return new Promise((resolve) => {
      const popup = window.open(
        authUrl.toString(),
        'google_silent_refresh',
        'width=1,height=1,left=-9999,top=-9999'
      );

      if (!popup) {
        console.warn('Silent refresh popup blocked');
        resolve(null);
        return;
      }

      const checkPopup = setInterval(() => {
        try {
          if (!popup.closed) {
            const popupUrl = popup.location.href;
            if (popupUrl.includes('access_token=')) {
              const urlParams = new URLSearchParams(popupUrl.split('#')[1]);
              const newToken = urlParams.get('access_token');
              
              if (newToken) {
                accessToken = newToken;
                clearInterval(checkPopup);
                popup.close();
                
                // Save new token
                saveGoogleDriveToken(userId, newToken).catch(err => {
                  console.error('Error saving refreshed token:', err);
                });
                
                resolve(newToken);
              }
            }
          } else {
            clearInterval(checkPopup);
            resolve(null);
          }
        } catch (e) {
          // Cross-origin, normal
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkPopup);
        if (!popup.closed) popup.close();
        resolve(null);
      }, 30000); // 30 second timeout for silent refresh
    });
  } catch (error) {
    console.error('Silent refresh error:', error);
    return null;
  }
};

/**
 * Save token to Firestore
 */
export const saveGoogleDriveToken = async (userId: string, token: string) => {
  try {
    await setDoc(doc(db, 'userGoogleDriveTokens', userId), {
      token,
      createdAt: Timestamp.fromDate(new Date()),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600000)), // 1 hour
    });
  } catch (error) {
    console.error('Error saving token:', error);
    throw new Error('Kon token niet opslaan');
  }
};

/**
 * Get token from Firestore
 */
export const getGoogleDriveToken = async (userId: string): Promise<string | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'userGoogleDriveTokens', userId));
    
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    const expiresAt = data.expiresAt.toDate();

    if (new Date() > expiresAt) {
      return null;
    }

    return data.token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

/**
 * Create or get folder
 */
export const createOrGetFolder = async (folderName: string, token: string, parentFolderId?: string): Promise<string> => {
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
 * Upload file to Drive
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
 * Save invoice metadata to Firestore with Drive reference and OCR data
 */
export const saveInvoiceWithDriveFile = async (
  invoiceData: any,
  driveFileId: string,
  driveWebLink: string,
  userId: string,
  companyId: string,
  ocrData?: any
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
      ocrProcessed: !!ocrData,
      ocrData: ocrData || null,
      ocrConfidence: ocrData?.confidence || 0,
    };

    const docRef = await addDoc(collection(db, 'incomingInvoices'), docData);
    return docRef.id;
  } catch (error) {
    console.error('Error saving invoice:', error);
    throw new Error('Kon factuur niet opslaan');
  }
};

/**
 * Get or create company folder structure
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
  const rootFolderId = await createOrGetFolder('Alloon', token);
  const companyFolderId = await createOrGetFolder(companyName, token, rootFolderId);
  const incomingInvoicesFolderId = await createOrGetFolder('Inkomende Facturen', token, companyFolderId);
  const outgoingInvoicesFolderId = await createOrGetFolder('Uitgaande Facturen', token, companyFolderId);
  await createOrGetFolder('Exports', token, companyFolderId);

  await setDoc(doc(db, 'driveFolderStructure', companyId), {
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
};

/**
 * Get company folder structure
 */
export const getCompanyDriveFolders = async (companyId: string) => {
  try {
    const docSnap = await getDoc(doc(db, 'driveFolderStructure', companyId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error('Error getting folder structure:', error);
    return null;
  }
};

/**
 * Upload invoice to Drive with OCR data
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
  },
  ocrData?: any
): Promise<{
  invoiceId: string;
  driveFileId: string;
  driveWebLink: string;
}> => {
  try {
    console.log('Getting/refreshing Google Drive token...');
    
    // Try to get token, silently refresh if expired
    let token = await silentRefreshGoogleToken(userId, userEmail);
    
    if (!token) {
      throw new Error('Google Drive not connected. Please connect in Settings.');
    }

    console.log('Checking/creating folder structure for company:', companyName);

    // Check if folders exist, if not create them
    let folders = await getCompanyDriveFolders(companyId);
    if (!folders) {
      console.log('Folder structure not found, creating...');
      folders = await getOrCreateCompanyDriveFolder(companyId, companyName, token);
      console.log('Folder structure created:', folders);
    } else {
      console.log('Using existing folder structure:', folders);
    }

    const uploadResult = await uploadFileToDrive(
      file,
      folders.incomingInvoicesFolderId,
      token,
      `${metadata?.invoiceNumber || 'INV'}-${Date.now()}.pdf`
    );

    console.log('File uploaded to:', uploadResult.webViewLink);

    // Save invoice with OCR data
    const invoiceId = await saveInvoiceWithDriveFile(
      {
        supplierName: metadata?.supplierName || 'Onbekend',
        invoiceNumber: metadata?.invoiceNumber || `INV-${Date.now()}`,
        totalAmount: metadata?.amount || 0,
        fileName: file.name,
      },
      uploadResult.fileId,
      uploadResult.webViewLink,
      userId,
      companyId,
      ocrData
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