import { db } from '../lib/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

const CLIENT_ID = '896567545879-t7ps2toen24v8nrjn5ulf59esnjg1hok.apps.googleusercontent.com';
const REDIRECT_URI = window.location.origin;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

let accessToken: string | null = null;

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
        // Cross-origin error, normal
      }
    }, 500);

    setTimeout(() => {
      clearInterval(checkPopup);
      if (!popup.closed) popup.close();
      reject(new Error('Google auth timeout'));
    }, 600000);
  });
};

export const silentRefreshGoogleToken = async (userId: string, userEmail?: string): Promise<string | null> => {
  try {
    const token = await getGoogleDriveToken(userId);
    
    if (token) {
      return token;
    }

    console.log('Token expired, refreshing...');
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'token');
    authUrl.searchParams.append('scope', SCOPES.join(' '));
    authUrl.searchParams.append('prompt', '');
    
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
                saveGoogleDriveToken(userId, newToken).catch(() => {});
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
      }, 30000);
    });
  } catch (error) {
    console.error('Silent refresh error:', error);
    return null;
  }
};

export const saveGoogleDriveToken = async (userId: string, token: string) => {
  try {
    await setDoc(doc(db, 'userGoogleDriveTokens', userId), {
      token,
      createdAt: Timestamp.fromDate(new Date()),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 3600000)),
    });
  } catch (error) {
    console.error('Error saving token:', error);
    throw new Error('Kon token niet opslaan');
  }
};

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

export const findOrCreateFolder = async (
  folderName: string,
  token: string,
  parentFolderId?: string
): Promise<string> => {
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
    console.log(`✓ Folder found: ${folderName} (${searchData.files[0].id})`);
    return searchData.files[0].id;
  }

  console.log(`→ Creating folder: ${folderName}`);

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

  console.log(`✓ Folder created: ${folderName} (${createData.id})`);
  return createData.id;
};

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

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error?.message || 'Upload failed');
    } catch (e) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
  }

  const data = await response.json();

  return {
    fileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    downloadLink: `https://drive.google.com/file/d/${data.id}/view`,
    name: data.name,
  };
};

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
    console.log(`Uploading: ${file.name} for ${companyName}`);
    
    let token = await silentRefreshGoogleToken(userId, userEmail);
    
    if (!token) {
      throw new Error('Google Drive not connected. Please connect in Settings.');
    }

    // Create folder structure in Drive
    console.log('Creating folder structure...');
    
    const alloonFolderId = await findOrCreateFolder('Alloon', token);
    const companyFolderId = await findOrCreateFolder(companyName, token, alloonFolderId);
    
    // Create category folders
    const inkoopFolderId = await findOrCreateFolder('Inkoop', token, companyFolderId);
    const verkoopFolderId = await findOrCreateFolder('Verkoop', token, companyFolderId);
    const productieFolderId = await findOrCreateFolder('Productie', token, companyFolderId);

    console.log('Uploading file...');

    // Upload file
    const uploadResult = await uploadFileToDrive(
      file,
      monthFolderId,
      token,
      `${metadata?.invoiceNumber || 'INV'}-${Date.now()}.${file.name.split('.').pop()}`
    );

    console.log(`✓ Upload complete: ${uploadResult.webViewLink}`);

    // Return invoice data (no Firestore save, just Drive data)
    return {
      invoiceId: uploadResult.fileId,
      driveFileId: uploadResult.fileId,
      driveWebLink: uploadResult.webViewLink,
    };
  } catch (error) {
    console.error('Error uploading invoice to Drive:', error);
    throw error;
  }
};