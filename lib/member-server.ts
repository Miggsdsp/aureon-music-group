import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

export type MemberPlan = 'listener' | 'creator';

export async function requireMember(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('UNAUTHENTICATED');

  const decoded = await adminAuth.verifyIdToken(token, true);
  const memberRef = adminFirestore.collection('members').doc(decoded.uid);
  const memberSnapshot = await memberRef.get();
  const member = memberSnapshot.exists ? memberSnapshot.data() || {} : {};

  return {
    uid: decoded.uid,
    email: decoded.email || String(member.email || ''),
    name: decoded.name || String(member.name || ''),
    memberRef,
    member,
  };
}

export function hasActivePlan(member: Record<string, any>, required?: MemberPlan) {
  const status = String(member.subscriptionStatus || '').toLowerCase();
  const statusAllowsAccess = status === 'active' || status === 'trialing';

  // Fail closed. Premium access requires both an eligible Stripe status and the
  // explicit server-managed access flag. A failed-payment webhook sets this
  // flag to false immediately, preventing streaming, downloads and licences.
  if (!statusAllowsAccess || member.subscriptionActive !== true) return false;

  const plan = String(member.plan || '').toLowerCase();
  if (plan !== 'listener' && plan !== 'creator') return false;

  if (!required) return true;
  if (required === 'listener') return plan === 'listener' || plan === 'creator';

  // Creator benefits require the Creator plan and its separate licence flag.
  return plan === 'creator' && member.creatorLicenseActive === true;
}

export function memberError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'UNAUTHENTICATED') return { status: 401, error: 'Please sign in first.' };
  return { status: 500, error: 'The member service could not complete this request.' };
}
