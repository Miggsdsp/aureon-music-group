import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAdminApi } from '@/lib/require-admin-api';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { analyticsContextFromStripe, trustedDedupeId } from '@/lib/analytics-server';
import { getSubscriptionPlan } from '@/lib/subscription-sync';

export const runtime = 'nodejs';

const clean = (value: unknown, max = 300) => String(value || '').trim().slice(0, max);
const safeId = (value: unknown, prefix: string) => {
  const text = clean(value, 120);
  return text.startsWith(prefix) ? text : '';
};
const timestamp = (value: any) => value?.toDate?.()?.toISOString?.() || (typeof value === 'string' ? value : '');

export async function POST(request: Request) {
  try {
    await requireAdminApi(request);
    const body = await request.json().catch(() => ({}));
    const stripeEventId = safeId(body?.stripeEventId, 'evt_');
    if (!stripeEventId) return NextResponse.json({ error: 'INVALID_STRIPE_EVENT_ID' }, { status: 400 });

    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '';
    const apiSecret = process.env.GA4_API_SECRET || '';
    const collectEndpoint = 'https://www.google-analytics.com/mp/collect';
    const debugEndpoint = 'https://www.google-analytics.com/debug/mp/collect';

    const stripe = getStripe();
    const event = await stripe.events.retrieve(stripeEventId);
    if (!event.livemode) return NextResponse.json({ error: 'INVALID_NON_LIVE_EVENT' }, { status: 400 });
    if (event.type !== 'checkout.session.completed') return NextResponse.json({ error: 'INVALID_EVENT_TYPE' }, { status: 400 });

    const eventSession = event.data.object as Stripe.Checkout.Session;
    const checkoutSession = await stripe.checkout.sessions.retrieve(eventSession.id);
    if (checkoutSession.mode !== 'subscription') return NextResponse.json({ error: 'INVALID_SESSION_MODE' }, { status: 400 });
    if (typeof checkoutSession.subscription !== 'string') return NextResponse.json({ error: 'INVALID_SUBSCRIPTION_ID' }, { status: 400 });

    const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
    const plan = getSubscriptionPlan(subscription);
    const context = analyticsContextFromStripe(checkoutSession.metadata);
    const eventId = trustedDedupeId('subscription_complete', subscription.id);
    const snapshot = await adminFirestore.collection('analyticsEvents').doc(eventId).get();
    const stored = snapshot.data() || {};
    const debugPayload = {
      client_id: '1234567890.1234567890',
      events: [{
        name: 'subscription_complete',
        params: {
          event_id: `diagnostic_${Date.now()}`,
          content_type: 'subscription',
          content_id: plan,
          plan,
          currency: String(checkoutSession.currency || 'eur').toUpperCase(),
          value: Number(checkoutSession.amount_total || 0) / 100,
          debug_mode: 1,
        },
      }],
    };

    let validation: { attempted: boolean; httpStatus?: number; body?: unknown; error?: string } = { attempted: false };
    if (measurementId && apiSecret) {
      try {
        const response = await fetch(`${debugEndpoint}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(debugPayload),
        });
        const text = await response.text();
        let parsed: unknown = text;
        try { parsed = JSON.parse(text); } catch { parsed = clean(text, 1000); }
        validation = { attempted: true, httpStatus: response.status, body: parsed };
      } catch (error) {
        validation = { attempted: true, error: error instanceof Error ? clean(error.message, 300) : 'unknown_error' };
      }
    }

    return NextResponse.json({
      ok: true,
      stripeEventId,
      checkoutSessionId: checkoutSession.id,
      subscriptionId: subscription.id,
      storedEventId: eventId,
      measurementId,
      apiSecretConfigured: Boolean(apiSecret),
      collectEndpoint,
      debugEndpoint,
      eventNameTransmitted: 'subscription_complete',
      analyticsConsent: context.analyticsConsent === true,
      clientIdPresent: Boolean(context.visitorId),
      clientIdLooksLikeGaClientId: /^\d+\.\d+$/.test(String(context.visitorId || '')),
      storedRecordExists: snapshot.exists,
      storedDelivery: {
        eventType: clean(stored.eventType, 80),
        plan: clean(stored.plan, 40),
        ga4Status: clean(stored.ga4Status, 40),
        ga4Attempted: stored.ga4Attempted === true,
        ga4HttpStatus: Number(stored.ga4HttpStatus || 0) || null,
        ga4Reason: clean(stored.ga4Reason, 300),
        ga4MeasurementId: clean(stored.ga4MeasurementId, 40),
        ga4Endpoint: clean(stored.ga4Endpoint, 80),
        ga4ValidationHttpStatus: Number(stored.ga4ValidationHttpStatus || 0) || null,
        ga4ValidationMessages: Array.isArray(stored.ga4ValidationMessages) ? stored.ga4ValidationMessages : [],
        ga4ResponseBody: clean(stored.ga4ResponseBody, 300),
        receivedAt: clean(stored.receivedAt, 80),
        ga4UpdatedAt: timestamp(stored.ga4UpdatedAt),
      },
      debugValidation: validation,
      debugPayloadShape: {
        client_id: debugPayload.client_id,
        events: debugPayload.events.map(eventItem => ({
          name: eventItem.name,
          params: Object.keys(eventItem.params),
        })),
      },
    });
  } catch (error) {
    console.error('Subscription conversion diagnostics failed:', { code: error instanceof Error ? error.message : 'UNKNOWN' });
    return NextResponse.json({ error: 'Subscription conversion diagnostics failed.' }, { status: 500 });
  }
}
