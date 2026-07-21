import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

function periodEnd(subscription: Stripe.Subscription) {
  const value = subscription.items.data[0]?.current_period_end;
  return value ? new Date(value * 1000) : null;
}

export async function POST(request: Request) {
  try {
    const { uid, memberRef } = await requireMember(request);
    const body = await request.json();
    const sessionId = String(body?.sessionId || '');
    if (!sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'A valid Stripe checkout session is required.' }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    if (session.mode !== 'subscription' || session.payment_status === 'unpaid') {
      return NextResponse.json({ error: 'The subscription payment has not completed.' }, { status: 409 });
    }

    const sessionUid = String(session.metadata?.firebaseUid || '');
    if (!sessionUid || sessionUid !== uid) {
      return NextResponse.json({ error: 'This checkout session does not belong to the signed-in account.' }, { status: 403 });
    }

    const subscription = typeof session.subscription === 'string'
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription as Stripe.Subscription | null;
    if (!subscription) {
      return NextResponse.json({ error: 'Stripe did not return the subscription record.' }, { status: 502 });
    }

    const plan = String(subscription.metadata?.plan || session.metadata?.plan || 'listener');
    const status = subscription.status;
    const active = status === 'active' || status === 'trialing';
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    await memberRef.set({
      uid,
      plan,
      subscriptionStatus: status,
      subscriptionActive: active,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: periodEnd(subscription),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      creatorLicenseActive: plan === 'creator' && active,
      monthlyDownloadLimit: active ? 5 : 0,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await adminFirestore.collection('subscriptionEvents').add({
      uid,
      plan,
      status,
      source: 'checkout-confirmation',
      stripeCheckoutSessionId: session.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ plan, status, active });
  } catch (error) {
    console.error('Subscription confirmation failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
