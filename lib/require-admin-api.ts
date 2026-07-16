import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

export async function requireAdminApi(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHENTICATED');

  const decoded = await adminAuth.verifyIdToken(token);
  let snapshot = await adminFirestore.collection('admins').doc(decoded.uid).get();
  if (!snapshot.exists) snapshot = await adminFirestore.collection('admin').doc(decoded.uid).get();
  if (!snapshot.exists || snapshot.data()?.active !== true) throw new Error('FORBIDDEN');

  return { uid: decoded.uid, email: decoded.email || '', profile: snapshot.data() || {} };
}
