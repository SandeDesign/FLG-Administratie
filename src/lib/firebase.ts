import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// ✅ SECURITY: These should come from environment variables
// Create .env.local file with:
// VITE_FIREBASE_API_KEY=...
// VITE_FIREBASE_AUTH_DOMAIN=...
// etc.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alloon.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alloon",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alloon.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "896567545879",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:896567545879:web:1ebbf02a7a8ac1c7d50c52",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-Y1R80QE0XN"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;