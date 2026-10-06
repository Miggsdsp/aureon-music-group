import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAdminApi } from '@/lib/require-admin-api';
import { getStripe } from '@/lib/stripe-server';
import { analyticsContextFromStripe, repairTrustedAnalyticsDelivery } from '@/lib/analytics-server';
import { getSubscriptionPlan, resolveFirebaseUid } from '@/lib/subscription-sync';

export const runtime = 'nodejs';

function safeId(value: unknown, prefix: string) {
  const text = String(value || '').trim();
  return text.startsWith(prefix) ? text : '';
}

function statusCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED') return 401;
  if (message === 'FORBIDDEN') return 403;
  if (message === 'CONFIRM_REQUIRED') return 409;
  if (message.startsWith('INVALID_')) return 400;
  return 500;
}

export async function POST(request: Request) {
  try {
    await requireAdminApi(request);
    const body = await request.json().catch(() => ({}));
    const stripeEventId = safeId(body?.stripeEventId, 'evt_');
    const confirm = body?.confirm === true;
    if (!stripeEventId) throw new Error('INVALID_STRIPE_EVENT_ID');

    const stripe = getStripe();
    const event = await stripe.events.retrieve(stripeEventId);
    if (!event.livemode) throw new Error('INVALID_NON_LIVE_EVENT');
    if (event.type !== 'checkout.session.completed') throw new Error('INVALID_EVENT_TYPE');

    const eventSession = event.data.object as Stripe.Checkout.Session;
    const checkoutSession = await stripe.checkout.sessions.retrieve(eventSession.id);
    if (checkoutSession.mode !== 'subscription') throw new Error('INVALID_SESSION_MODE');
    if (checkoutSession.payment_status === 'unpaid') throw new Error('INVALID_UNPAID_SESSION');
    if (typeof checkoutSession.subscription !== 'string') throw new Error('INVALID_SUBSCRIPTION_ID');

    const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
    const plan = getSubscriptionPlan(subscription);
    const context = analyticsContextFromStripe(checkoutSession.metadata);
    const analyticsInput = {
      ...context,
      eventType: 'subscription_complete' as const,
      entityType: 'subscription',
      entityId: plan,
      plan,
      revenueCents: checkoutSession.amount_total || 0,
      currency: checkoutSession.currency || 'eur',
      memberId: await resolveFirebaseUid(subscription),
    };

    if (!confirm) {
      throw new Error('CONFIRM_REQUIRED');
    }

    const repair = await repairTrustedAnalyticsDelivery(analyticsInput, subscription.id);
    console.info('[Aureon trusted analytics] manual_subscription_repair_result', {
      eventId: repair.eventId.slice(0, 12),
      plan,
      status: repair.status,
      attempted: repair.attempted,
      httpStatus: repair.httpStatus || 0,
      hasConsent: context.analyticsConsent === true,
      hasClientId: Boolean(context.visitorId),
    });

    return NextResponse.json({
      ok: true,
      stripeEventId,
      checkoutSessionId: checkoutSession.id,
      subscriptionId: subscription.id,
      plan,
      amountTotal: checkoutSession.amount_total || 0,
      currency: checkoutSession.currency || 'eur',
      analyticsConsent: context.analyticsConsent === true,
      hasAnalyticsClientId: Boolean(context.visitorId),
      repair: {
        eventId: repair.eventId,
        created: repair.created,
        status: repair.status,
        attempted: repair.attempted,
        httpStatus: repair.httpStatus || null,
        reason: repair.reason || '',
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'CONFIRM_REQUIRED') {
      return NextResponse.json({ error: 'Re-submit with confirm:true after verifying this is the original paid Listener or Creator checkout.session.completed event.' }, { status: 409 });
    }
    console.error('Subscription conversion repair failed:', { code });
    return NextResponse.json({ error: 'Subscription conversion repair failed.', code }, { status: statusCode(error) });
  }
}
