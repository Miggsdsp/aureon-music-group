import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import {
  getSubscriptionPeriodEnd,
  getSubscriptionPlan,
  markInvoicePaymentFailure,
  recordInvoicePaid,
  resolveFirebaseUid,
  syncStripeSubscription,
  type AureonPlan,
} from '@/lib/subscription-sync';
import { sendSubscriptionLifecycleEmail, type SubscriptionEmailKind } from '@/lib/transactional-email';

export const runtime = 'nodejs';

async function subscriptionFromInvoice(invoice: Stripe.Invoice) {
  const value = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } | null } | null;
  };
  const subscriptionValue = value.parent?.subscription_details?.subscription ?? value.subscription;
  const subscriptionId = typeof subscriptionValue === 'string' ? subscriptionValue : subscriptionValue?.id;
  return subscriptionId ? getStripe().subscriptions.retrieve(subscriptionId) : null;
}

function webhookSecrets() {
  return [process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET, process.env.STRIPE_SUBSCRIPTION_TEST_WEBHOOK_SECRET]
    .flatMap(value => value?.split(',') ?? [])
    .map(value => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
}

function constructStripeEvent(payload: string, signature: string) {
  const secrets = webhookSecrets();
  if (secrets.length === 0) throw new Error('Subscription webhook secret not configured.');
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return getStripe().webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Invalid Stripe webhook signature.');
}

async function sendMemberEmail(subscription: Stripe.Subscription, kind: SubscriptionEmailKind, options: { amountPaid?: number | null; currency?: string } = {}) {
  const uid = await resolveFirebaseUid(subscription);
  if (!uid) return;
  const memberSnapshot = await adminFirestore.collection('members').doc(uid).get();
  const member = memberSnapshot.data() || {};
  let email = String(member.email || '').trim();
  let name = String(member.name || '').trim();

  if (!email) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const customer = await getStripe().customers.retrieve(customerId);
    if (!customer.deleted) {
      email = String(customer.email || '').trim();
      name = name || String(customer.name || '').trim();
    }
  }
  if (!email) return;

  await sendSubscriptionLifecycleEmail({
    to: email,
    customerName: name,
    kind,
    plan: getSubscriptionPlan(subscription),
    effectiveDate: getSubscriptionPeriodEnd(subscription),
    amountPaid: options.amountPaid,
    currency: options.currency,
  });
}

async function memberState(subscription: Stripe.Subscription) {
  const uid = await resolveFirebaseUid(subscription);
  if (!uid) return null;
  const snapshot = await adminFirestore.collection('members').doc(uid).get();
  const data = snapshot.data() || {};
  return {
    plan: String(data.plan || '') as AureonPlan | '',
    status: String(data.subscriptionStatus || ''),
    cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
  };
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(await request.text(), signature);
  } catch (error) {
    console.error('Invalid subscription webhook signature:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    console.info('Stripe subscription webhook received:', event.type, event.id);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          await syncStripeSubscription(subscription, event.type);
          await sendMemberEmail(subscription, 'confirmed');
        }
        break;
      }

      case 'customer.subscription.created': {
        await syncStripeSubscription(event.data.object as Stripe.Subscription, event.type);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const before = await memberState(subscription);
        const nextPlan = getSubscriptionPlan(subscription);
        await syncStripeSubscription(subscription, event.type);

        if (before?.plan && before.plan !== nextPlan) {
          await sendMemberEmail(subscription, nextPlan === 'creator' ? 'upgraded' : 'downgraded');
        } else if (!before?.cancelAtPeriodEnd && subscription.cancel_at_period_end) {
          await sendMemberEmail(subscription, 'cancellation-scheduled');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(subscription, event.type);
        await sendMemberEmail(subscription, 'cancelled');
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await subscriptionFromInvoice(invoice);
        const before = subscription ? await memberState(subscription) : null;
        await recordInvoicePaid(invoice);
        if (subscription) {
          await syncStripeSubscription(subscription, event.type);
          if (before && ['past_due', 'unpaid', 'incomplete'].includes(before.status)) {
            await sendMemberEmail(subscription, 'payment-restored', { amountPaid: invoice.amount_paid, currency: invoice.currency });
          } else if (invoice.billing_reason === 'subscription_cycle') {
            await sendMemberEmail(subscription, 'renewal-paid', { amountPaid: invoice.amount_paid, currency: invoice.currency });
          }
        }
        break;
      }

      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await subscriptionFromInvoice(invoice);
        if (subscription) await syncStripeSubscription(subscription, event.type);
        await markInvoicePaymentFailure(invoice);
        if (subscription) await sendMemberEmail(subscription, 'payment-failed');
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Subscription webhook processing failed:', event.type, error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
