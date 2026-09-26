import { createHash, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

const OWNER_EMAIL = 'mpinho46@yahoo.com';
const TOKEN_HASH = 'b59c91b700de8220f13bfbb1d3cbd9ab6831b144505b4c35b566e538e8f2b4f1';
const EXPIRES_AT = Date.parse('2026-09-26T12:00:00Z');

function validRecoveryToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const actual = createHash('sha256').update(token).digest();
  const expected = Buffer.from(TOKEN_HASH, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  if (Date.now() > EXPIRES_AT) {
    return NextResponse.json({ error: 'Recovery window expired.' }, { status: 410 });
  }
  if (!validRecoveryToken(request)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  try {
    const user = await adminAuth.getUserByEmail(OWNER_EMAIL);
    if (user.disabled) {
      return NextResponse.json({ error: 'Owner authentication account is disabled.' }, { status: 409 });
    }

    await adminFirestore.collection('admins').doc(user.uid).set({
      email: OWNER_EMAIL,
      name: 'Miguel Pinho',
      role: 'superAdmin',
      active: true,
      recoveredAt: FieldValue.serverTimestamp(),
      recoverySource: 'one-time-owner-recovery'
    }, { merge: true });

    return NextResponse.json({ restored: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[owner-recovery] failed', error);
    return NextResponse.json({ error: 'Recovery failed.' }, { status: 500 });
  }
}
