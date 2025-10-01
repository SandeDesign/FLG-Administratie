import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBAC-tl3pCXeUwGlw13tW2-vpwgsG9_jiI",
  authDomain: "alloon.firebaseapp.com",
  projectId: "alloon",
  storageBucket: "alloon.firebasestorage.app",
  messagingSenderId: "896567545879",
  appId: "1:896567545879:web:1ebbf02a7a8ac1c7d50c52",
  measurementId: "G-Y1R80QE0XN"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;