import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0];
  const value = firstItem?.current_period_end;
  return value ? new Date(value * 1000) : null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const uid = String(subscription.metadata.firebaseUid || '');
  if (!uid) throw new Error('Subscription is missing firebaseUid metadata.');
  const plan = String(subscription.metadata.plan || 'listener');
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const status = subscription.status;
  const active = status === 'active' || status === 'trialing';

  await adminFirestore.collection('members').doc(uid).set({
    uid,
    plan,
    subscriptionStatus: status,
    subscriptionActive: active,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    creatorLicenseActive: plan === 'creator' && active,
    monthlyDownloadLimit: active ? 5 : 0,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await adminFirestore.collection('subscriptionEvents').add({
    uid,
    plan,
    status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Subscription webhook secret not configured.' }, { status: 500 });
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    console.error('Invalid subscription webhook signature:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription);
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Subscription webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
