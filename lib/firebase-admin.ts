import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getPrivateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = getPrivateKey();
const storageBucket = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp(
      projectId && clientEmail && privateKey
        ? {
            credential: cert({ projectId, clientEmail, privateKey }),
            projectId,
            ...(storageBucket ? { storageBucket } : {})
          }
        : storageBucket
          ? { storageBucket }
          : undefined
    );

export const adminFirestore = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
