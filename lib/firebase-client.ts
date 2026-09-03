'use client';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBufq7mq54-0i1IpM6K8vAHxW0BkJXwILk',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'aureon-music-group.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'aureon-music-group',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'aureon-music-group.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '900726492701',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:900726492701:web:60585a1d0774740ccc40f4',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-P9CQ5RHT3K'
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;

if (typeof window !== 'undefined' && appCheckSiteKey) {
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

// Some mobile networks/content filters intermittently block direct requests to
// Google's Firebase Auth hosts, which surfaces as auth/network-request-failed
// even though the Aureon site itself is online. In production we send Firebase
// Auth traffic through same-origin Aureon proxy routes instead. This keeps the
// normal Firebase client session/persistence behaviour while avoiding those
// direct cross-origin failures on iPhone/Safari and cellular networks.
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const authWithConfig = firebaseAuth as typeof firebaseAuth & {
    config?: { apiHost?: string; apiScheme?: string; tokenApiHost?: string };
  };
  if (authWithConfig.config) {
    authWithConfig.config.apiScheme = window.location.protocol.replace(':', '') || 'https';
    authWithConfig.config.apiHost = `${window.location.host}/api/firebase-auth`;
    authWithConfig.config.tokenApiHost = `${window.location.host}/api/firebase-token`;
  }
}

export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
