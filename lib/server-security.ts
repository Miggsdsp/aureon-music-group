import { createHash } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export function clientIp(request: Request) {
  return (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')
    .split(',')[0]
    .trim()
    .slice(0, 120);
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

export function validEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(value, 180).toLowerCase());
}

function rateKey(scope: string, identifier: string) {
  return createHash('sha256').update(`${scope}:${identifier}`).digest('hex');
}

export async function enforceRateLimit(scope: string, identifier: string, limit: number, windowMs: number) {
  const ref = adminFirestore.collection('_rateLimits').doc(rateKey(scope, identifier));
  const now = Date.now();
  return adminFirestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const resetAt = data.resetAt?.toMillis?.() || 0;
    const count = resetAt > now ? Number(data.count || 0) : 0;
    if (count >= limit) return false;
    transaction.set(ref, {
      scope,
      count: count + 1,
      resetAt: Timestamp.fromMillis(resetAt > now ? resetAt : now + windowMs),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

export async function writeAuditLog(action: string, details: Record<string, unknown>) {
  await adminFirestore.collection('auditLogs').add({
    action,
    ...details,
    createdAt: FieldValue.serverTimestamp(),
  });
}
