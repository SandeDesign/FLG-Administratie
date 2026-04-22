// Firebase Admin SDK singleton voor Netlify Functions.
//
// Service account credentials komen uit env var FIREBASE_SERVICE_ACCOUNT_JSON
// (volledige JSON als string). Die wordt ingesteld in Netlify dashboard.
//
// Genereren: Firebase Console → Project Settings → Service Accounts →
// "Generate new private key" → download JSON → kopieer volledige inhoud
// als één string (met de \n in private_key gewoon laten staan) naar de env var.

import * as admin from 'firebase-admin';

let initialized = false;

export const getAdmin = (): typeof admin => {
  if (!initialized) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON env var ontbreekt — zet deze in Netlify.'
      );
    }
    let serviceAccount: admin.ServiceAccount;
    try {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_JSON is geen geldige JSON. Plak de volledige service account JSON als één string.'
      );
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    initialized = true;
  }
  return admin;
};

export const getDb = () => getAdmin().firestore();
export const getMessaging = () => getAdmin().messaging();
export const getAuthAdmin = () => getAdmin().auth();
