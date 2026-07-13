import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Invalid Stripe webhook signature:', error);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true });

      const songIds = String(session.metadata?.songIds || '').split(',').filter(Boolean);
      const customerEmail = session.customer_details?.email || session.customer_email || '';
      const customerName = session.customer_details?.name || `${session.metadata?.firstName || ''} ${session.metadata?.surname || ''}`.trim();
      const orderRef = adminFirestore.collection('orders').doc(session.id);
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || '';

      await adminFirestore.runTransaction(async transaction => {
        const existing = await transaction.get(orderRef);
        if (existing.exists && existing.data()?.status === 'paid') return;

        const customerRef = adminFirestore.collection('customers').doc(customerEmail || session.id);
        transaction.set(customerRef, {
          email: customerEmail,
          name: customerName,
          phone: session.customer_details?.phone || session.metadata?.phone || '',
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || '',
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        transaction.set(orderRef, {
          orderNumber: `AUR-${session.created}-${session.id.slice(-6).toUpperCase()}`,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          customerEmail,
          customerName,
          currency: session.currency || 'eur',
          amountTotal: session.amount_total || 0,
          songIds,
          status: 'paid',
          paymentStatus: session.payment_status,
          downloadStatus: 'available',
          createdAt: FieldValue.serverTimestamp(),
          paidAt: FieldValue.serverTimestamp()
        }, { merge: true });

        const paymentRef = adminFirestore.collection('payments').doc(paymentIntentId || session.id);
        transaction.set(paymentRef, {
          orderId: session.id,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          customerEmail,
          amount: session.amount_total || 0,
          currency: session.currency || 'eur',
          status: 'paid',
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        for (const songId of songIds) {
          const downloadRef = adminFirestore.collection('downloads').doc(`${session.id}_${songId}`);
          transaction.set(downloadRef, {
            orderId: session.id,
            songId,
            customerEmail,
            active: true,
            maxDownloads: 3,
            downloadCount: 0,
            expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
            createdAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await adminFirestore.collection('orders').doc(session.id).set({
        stripeCheckoutSessionId: session.id,
        status: 'expired',
        paymentStatus: session.payment_status,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
