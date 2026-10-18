'use client';

import './firebase-auth-fetch-proxy';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const localTestMode = process.env.NEXT_PUBLIC_AUREON_ENVIRONMENT === 'local-test';
const localTestProjectId = 'demo-aureon-music-group';
const configuredProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (localTestMode && configuredProjectId !== localTestProjectId) {
  throw new Error(`Aureon local-test browser requires Firebase project ${localTestProjectId}.`);
}

const firebaseConfig = localTestMode
  ? {
      apiKey: 'demo-api-key',
      authDomain: 'localhost',
      projectId: localTestProjectId,
      storageBucket: `${localTestProjectId}.appspot.com`,
      messagingSenderId: '123456789',
      appId: '1:123456789:web:aureon-local-test',
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBufq7mq54-0i1IpM6K8vAHxW0BkJXwILk',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'aureon-music-group.firebaseapp.com',
      projectId: configuredProjectId || 'aureon-music-group',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'aureon-music-group.firebasestorage.app',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '900726492701',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:900726492701:web:60585a1d0774740ccc40f4',
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

if (localTestMode && firebaseApp.options.projectId !== localTestProjectId) {
  throw new Error('Aureon local-test browser initialized a non-test Firebase app.');
}

const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;

if (typeof window !== 'undefined' && !localTestMode && appCheckSiteKey) {
  try {
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    // In development, hot reload can attempt to initialize App Check more than once.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('already')) {
      console.error('Firebase App Check initialization failed:', error);
    }
  }
}

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

if (typeof window !== 'undefined' && localTestMode) {
  const connect = (operation: () => void) => {
    try {
      operation();
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (!message.includes('already') && !message.includes('emulator')) throw error;
    }
  };

  connect(() => connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true }));
  connect(() => connectFirestoreEmulator(firestore, '127.0.0.1', 8080));
  connect(() => connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199));
}
