import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { assertRuntimeIsolation, LOCAL_TEST_PROJECT } from '@/lib/runtime-safety';

function getPrivateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = getPrivateKey();
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const localTestMode = assertRuntimeIsolation();

if (localTestMode && projectId !== LOCAL_TEST_PROJECT) {
  throw new Error(`Aureon local-test Admin SDK requires Firebase project ${LOCAL_TEST_PROJECT}.`);
}

const existingApp = getApps()[0];
if (localTestMode && existingApp && existingApp.options.projectId !== LOCAL_TEST_PROJECT) {
  throw new Error('Aureon local-test Admin SDK found an existing non-test Firebase app.');
}

const adminApp = existingApp || initializeApp(
  localTestMode
    ? { projectId: LOCAL_TEST_PROJECT, storageBucket: `${LOCAL_TEST_PROJECT}.appspot.com` }
    : projectId && clientEmail && privateKey
      ? {
          credential: cert({ projectId, clientEmail, privateKey }),
          projectId,
          ...(storageBucket ? { storageBucket } : {})
        }
      : storageBucket
        ? { storageBucket }
        : undefined
);

export const adminAuth = getAuth(adminApp);
export const adminFirestore = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
