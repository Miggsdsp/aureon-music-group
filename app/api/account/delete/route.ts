import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function cancelMemberSubscriptions(member: Record<string, any>) {
  const stripe = getStripe();
  const ids = new Set<string>();
  if (member.stripeSubscriptionId) ids.add(String(member.stripeSubscriptionId));

  if (member.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({ customer: String(member.stripeCustomerId), status: 'all', limit: 100 });
      for (const subscription of subscriptions.data) {
        if (!['canceled', 'incomplete_expired'].includes(subscription.status)) ids.add(subscription.id);
      }
    } catch (error: any) {
      // A member created while Stripe was in sandbox can still carry a test-mode
      // customer ID after production switches to a live key. That customer does
      // not exist in live mode, so there is nothing live to cancel. Continue the
      // account deletion instead of blocking Firebase/Auth cleanup.
      if (error?.code !== 'resource_missing') throw error;
    }
  }

  for (const id of ids) {
    try {
      const subscription = await stripe.subscriptions.retrieve(id);
      if (!['canceled', 'incomplete_expired'].includes(subscription.status)) await stripe.subscriptions.cancel(id);
    } catch (error: any) {
      if (error?.code === 'resource_missing') continue;
      throw error;
    }
  }
  return [...ids];
}

export async function DELETE(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    const memberRef = adminFirestore.collection('members').doc(uid);
    const memberSnapshot = await memberRef.get();
    const member = memberSnapshot.data() || {};
    const email = String(decoded.email || member.email || '').trim().toLowerCase();
    const name = String(member.name || decoded.name || '').trim();
    const deletionRef = adminFirestore.collection('accountDeletions').doc();
    const uidHash = createHash('sha256').update(uid).digest('hex');

    await deletionRef.set({
      status: 'processing',
      uidHash,
      name,
      email,
      plan: String(member.plan || 'free'),
      subscriptionStatus: String(member.subscriptionStatus || 'inactive'),
      stripeCustomerId: String(member.stripeCustomerId || ''),
      stripeSubscriptionId: String(member.stripeSubscriptionId || ''),
      requestedAt: FieldValue.serverTimestamp(),
      source: 'self-service',
    });

    const cancelledSubscriptions = await cancelMemberSubscriptions(member);

    const licenceSnapshot = await adminFirestore.collection('licenses').where('uid', '==', uid).get();
    for (const licence of licenceSnapshot.docs) await adminFirestore.recursiveDelete(licence.ref);

    const orderSnapshot = await adminFirestore.collection('orders').where('memberUid', '==', uid).get();
    for (const order of orderSnapshot.docs) {
      await order.ref.set({ memberUid: FieldValue.delete(), accountDeletedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    if (memberSnapshot.exists) await adminFirestore.recursiveDelete(memberRef);
    await adminAuth.deleteUser(uid);

    await deletionRef.set({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      cancelledSubscriptions,
    }, { merge: true });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Account deletion failed:', uid || 'unknown', error);
    return NextResponse.json({ error: 'We could not delete your account safely. No further action is required from you; please try again or contact Aureon support.' }, { status: 500 });
  }
}
