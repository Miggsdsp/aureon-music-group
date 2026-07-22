import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember } from '@/lib/member-server';
import { syncStripeSubscription } from '@/lib/subscription-sync';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { uid } = await requireMember(request);
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

    const result = await syncStripeSubscription(subscription, 'checkout-confirmation');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Subscription confirmation failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
