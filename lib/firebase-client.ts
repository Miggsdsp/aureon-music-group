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

// Firebase Auth calls Identity Toolkit and Secure Token directly. On some iPhone/
// cellular combinations those Google hosts intermittently fail while Aureon itself
// remains reachable. Re-route only those two Firebase Auth hosts through Aureon's
// same-origin proxy before Firebase creates any network requests. This avoids
// relying on Firebase's private config internals and leaves Firestore/Storage alone.
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const marker = '__aureonFirebaseAuthFetchProxy';
  const globalWindow = window as typeof window & { [key: string]: unknown };
  if (!globalWindow[marker]) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const raw = input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.origin);
        let proxiedPath = '';
        if (url.hostname === 'identitytoolkit.googleapis.com') {
          proxiedPath = `/api/firebase-auth${url.pathname}${url.search}`;
        } else if (url.hostname === 'securetoken.googleapis.com') {
          proxiedPath = `/api/firebase-token${url.pathname}${url.search}`;
        }
        if (proxiedPath) {
          if (input instanceof Request) {
            const request = new Request(new URL(proxiedPath, window.location.origin), input);
            return nativeFetch(request, init);
          }
          return nativeFetch(proxiedPath, init);
        }
      } catch {
        // If URL parsing ever fails, use the browser's native request unchanged.
      }
      return nativeFetch(input, init);
    }) as typeof window.fetch;
    globalWindow[marker] = true;
  }
}

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
export const firestore = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);
