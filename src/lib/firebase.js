import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const runtimeEnv =
  (typeof import.meta !== 'undefined' && import.meta?.env) ||
  (typeof process !== 'undefined' ? process.env : {}) ||
  {};

const firebaseConfig = {
  apiKey: runtimeEnv.VITE_FIREBASE_API_KEY,
  authDomain: runtimeEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: runtimeEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: runtimeEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: runtimeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: runtimeEnv.VITE_FIREBASE_APP_ID,
};

const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
export { isFirebaseConfigured };
