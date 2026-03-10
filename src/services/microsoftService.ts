import { PublicClientApplication, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest, calendarRequest } from '../lib/msalConfig';
import { MicrosoftCalendarEvent, MicrosoftConnection } from '../types/microsoft';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

let msalInstance: PublicClientApplication | null = null;

/**
 * Initialiseer MSAL instance
 */
export const initializeMsal = async (): Promise<PublicClientApplication | null> => {
  if (!msalConfig.auth.clientId) {
    return null;
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
};

/**
 * Login met Microsoft account
 */
export const loginMicrosoft = async (): Promise<AccountInfo | null> => {
  const msal = await initializeMsal();
  if (!msal) throw new Error('Microsoft integratie is niet geconfigureerd. Stel VITE_MICROSOFT_CLIENT_ID in.');

  try {
    const response = await msal.loginPopup(loginRequest);
    return response.account;
  } catch (error) {
    console.error('Microsoft login error:', error);
    throw error;
  }
};

/**
 * Verkrijg access token (met silent refresh)
 */
const getAccessToken = async (): Promise<string> => {
  const msal = await initializeMsal();
  if (!msal) throw new Error('MSAL niet geïnitialiseerd');

  const accounts = msal.getAllAccounts();
  if (accounts.length === 0) throw new Error('Geen Microsoft account gekoppeld');

  try {
    const response = await msal.acquireTokenSilent({
      ...calendarRequest,
      account: accounts[0],
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const response = await msal.acquireTokenPopup(calendarRequest);
      return response.accessToken;
    }
    throw error;
  }
};

/**
 * Haal Microsoft kalender events op voor een periode
 */
export const getMicrosoftCalendarEvents = async (
  startDate: Date,
  endDate: Date
): Promise<MicrosoftCalendarEvent[]> => {
  try {
    const accessToken = await getAccessToken();

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startISO}&endDateTime=${endISO}&$top=100&$select=id,subject,start,end,location,isAllDay,bodyPreview,webLink,organizer`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Fout bij ophalen van kalender events');
    }

    const data = await response.json();
    return data.value as MicrosoftCalendarEvent[];
  } catch (error) {
    console.error('Error fetching Microsoft calendar events:', error);
    throw error;
  }
};

/**
 * Controleer of er een actief Microsoft account gekoppeld is
 */
export const isMicrosoftConnected = async (): Promise<boolean> => {
  const msal = await initializeMsal();
  if (!msal) return false;
  return msal.getAllAccounts().length > 0;
};

/**
 * Haal de gekoppelde Microsoft account info op
 */
export const getMicrosoftAccount = async (): Promise<AccountInfo | null> => {
  const msal = await initializeMsal();
  if (!msal) return null;
  const accounts = msal.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
};

/**
 * Verbreek Microsoft koppeling
 */
export const disconnectMicrosoft = async (userId: string): Promise<void> => {
  const msal = await initializeMsal();
  if (!msal) return;

  const accounts = msal.getAllAccounts();
  for (const account of accounts) {
    await msal.logout({ account });
  }

  // Verwijder connection info uit Firestore
  try {
    await deleteDoc(doc(db, 'microsoftConnections', userId));
  } catch (error) {
    console.error('Error removing Microsoft connection:', error);
  }
};

/**
 * Sla Microsoft connection info op in Firestore
 */
export const saveMicrosoftConnection = async (
  userId: string,
  account: AccountInfo
): Promise<void> => {
  try {
    const connection: MicrosoftConnection = {
      userId,
      microsoftAccountEmail: account.username || '',
      connectedAt: new Date(),
      isActive: true,
    };

    await setDoc(doc(db, 'microsoftConnections', userId), {
      ...connection,
      connectedAt: Timestamp.fromDate(connection.connectedAt),
    });
  } catch (error) {
    console.error('Error saving Microsoft connection:', error);
    throw error;
  }
};

/**
 * Haal Microsoft connection info op
 */
export const getMicrosoftConnection = async (userId: string): Promise<MicrosoftConnection | null> => {
  try {
    const docSnap = await getDoc(doc(db, 'microsoftConnections', userId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      ...data,
      connectedAt: data.connectedAt?.toDate ? data.connectedAt.toDate() : new Date(),
    } as MicrosoftConnection;
  } catch (error) {
    console.error('Error getting Microsoft connection:', error);
    return null;
  }
};
