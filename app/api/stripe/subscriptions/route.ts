import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-server';
import { markInvoicePaymentFailure, recordInvoicePaid, syncStripeSubscription } from '@/lib/subscription-sync';

export const runtime = 'nodejs';

async function subscriptionFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionValue = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscriptionValue === 'string' ? subscriptionValue : subscriptionValue?.id;
  return subscriptionId ? getStripe().subscriptions.retrieve(subscriptionId) : null;
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
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(event.data.object as Stripe.Subscription, event.type);
        break;

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          await syncStripeSubscription(subscription, event.type);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await recordInvoicePaid(invoice);
        const subscription = await subscriptionFromInvoice(invoice);
        if (subscription) await syncStripeSubscription(subscription, event.type);
        break;
      }

      case 'invoice.payment_failed':
      case 'invoice.payment_action_required': {
        const invoice = event.data.object as Stripe.Invoice;
        await markInvoicePaymentFailure(invoice);
        const subscription = await subscriptionFromInvoice(invoice);
        if (subscription) await syncStripeSubscription(subscription, event.type);
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
