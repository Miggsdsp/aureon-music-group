import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { memberRef } = await requireMember(request);
    const body = await request.json();
    const action = String(body?.action || '');
    if (action === 'subscription_checkout_started') {
      await memberRef.set({ subscriptionCheckoutStartedAt: FieldValue.serverTimestamp(), subscriptionCheckoutPlan: String(body?.plan || ''), lastActivityAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ ok: true });
    }
    if (action === 'email_preferences') {
      await memberRef.set({ marketingEmailsDisabled: body?.enabled !== true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unsupported lifecycle action.' }, { status: 400 });
  } catch (error) {
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
