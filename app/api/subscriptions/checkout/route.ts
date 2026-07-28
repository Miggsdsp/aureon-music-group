import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember, type MemberPlan } from '@/lib/member-server';
import { getSubscriptionPlan, syncStripeSubscription } from '@/lib/subscription-sync';
import { sendSubscriptionLifecycleEmail } from '@/lib/transactional-email';

export const runtime = 'nodejs';

const prices: Record<MemberPlan, string | undefined> = {
  listener: process.env.STRIPE_LISTENER_PRICE_ID,
  creator: process.env.STRIPE_CREATOR_PRICE_ID,
};

function configurationError(plan: MemberPlan) {
  const missing: string[] = [];
  const price = prices[plan];

  if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
  if (!price) missing.push(plan === 'listener' ? 'STRIPE_LISTENER_PRICE_ID' : 'STRIPE_CREATOR_PRICE_ID');
  if (!process.env.FIREBASE_ADMIN_PROJECT_ID) missing.push('FIREBASE_ADMIN_PROJECT_ID');
  if (!process.env.FIREBASE_ADMIN_CLIENT_EMAIL) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL');
  if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) missing.push('FIREBASE_ADMIN_PRIVATE_KEY');

  if (missing.length) return `Missing server configuration: ${missing.join(', ')}.`;
  if (!price?.startsWith('price_')) return `${plan} membership must use a Stripe Price ID beginning with price_.`;
  if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) return 'STRIPE_SECRET_KEY must be a Stripe secret key beginning with sk_.';

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
  if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
    return 'FIREBASE_ADMIN_PRIVATE_KEY is malformed. Copy the complete private_key value from the Firebase service-account JSON.';
  }

  return '';
}

function invoiceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const latestInvoice = subscription.latest_invoice;
  if (!latestInvoice) return null;
  if (typeof latestInvoice === 'string') return latestInvoice;
  return latestInvoice.id ?? null;
}

function periodEndFromSubscription(subscription: Stripe.Subscription): Date | null {
  const value = subscription as Stripe.Subscription & { current_period_end?: number | null };
  return value.current_period_end ? new Date(value.current_period_end * 1000) : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = String(body?.plan || '') as MemberPlan;
    if (!['listener', 'creator'].includes(plan)) {
      return NextResponse.json({ error: 'Choose a valid membership plan.' }, { status: 400 });
    }

    const configError = configurationError(plan);
    if (configError) return NextResponse.json({ error: configError }, { status: 500 });

    const { uid, email, name, memberRef, member } = await requireMember(request);
    const price = prices[plan] as string;
    const stripe = getStripe();

    const existingSubscriptionId = String(member.stripeSubscriptionId || '');
    if (existingSubscriptionId) {
      try {
        const existing = await stripe.subscriptions.retrieve(existingSubscriptionId);
        const stillManaged = !['canceled', 'incomplete_expired'].includes(existing.status);
        if (stillManaged) {
          const existingPlan = getSubscriptionPlan(existing);
          if (existingPlan === plan) {
            return NextResponse.json({ error: `Your ${plan === 'creator' ? 'Aureon Creator' : 'Aureon Listener'} subscription already exists. Use Manage billing to review it.` }, { status: 409 });
          }

          const item = existing.items.data[0];
          if (!item) return NextResponse.json({ error: 'Stripe subscription has no billable item.' }, { status: 409 });

          const isUpgrade = existingPlan === 'listener' && plan === 'creator';

          if (isUpgrade) {
            let updated: Stripe.Subscription;
            try {
              updated = await stripe.subscriptions.update(existing.id, {
                items: [{ id: item.id, price }],
                metadata: { ...existing.metadata, firebaseUid: uid, plan },
                cancel_at_period_end: false,
                proration_behavior: 'always_invoice',
                payment_behavior: 'error_if_incomplete',
                expand: ['latest_invoice'],
              });
            } catch (paymentError) {
              console.warn('Immediate Creator upgrade payment failed:', paymentError);
              const message = paymentError instanceof Error ? paymentError.message : 'The prorated upgrade payment could not be completed.';
              return NextResponse.json({
                paymentRequired: true,
                changed: false,
                plan: existingPlan,
                error: message,
              }, { status: 402 });
            }

            const latestInvoiceId = invoiceIdFromSubscription(updated);
            if (!latestInvoiceId) {
              return NextResponse.json({
                error: 'Stripe did not create an immediate upgrade invoice. Your Listener plan remains active.',
              }, { status: 502 });
            }

            const invoice = await stripe.invoices.retrieve(latestInvoiceId);
            const paid = invoice.status === 'paid' && invoice.amount_paid > 0;
            if (!paid) {
              return NextResponse.json({
                paymentRequired: true,
                changed: false,
                plan: existingPlan,
                url: invoice.hosted_invoice_url || null,
                message: 'Pay the prorated upgrade difference before Creator access is activated.',
              }, { status: invoice.hosted_invoice_url ? 200 : 402 });
            }

            const confirmed = await stripe.subscriptions.retrieve(updated.id);
            if (getSubscriptionPlan(confirmed) !== 'creator') {
              return NextResponse.json({
                error: 'The payment succeeded, but Stripe has not completed the plan change yet. Refresh the account in a moment.',
              }, { status: 409 });
            }

            await syncStripeSubscription(confirmed, 'account-paid-upgrade');

            // The account route performs the plan sync before Stripe's webhook is
            // delivered. Sending here guarantees one immediate upgrade receipt;
            // the webhook then sees Creator already stored and will not duplicate it.
            if (email) {
              try {
                await sendSubscriptionLifecycleEmail({
                  to: email,
                  customerName: name,
                  kind: 'upgraded',
                  plan: 'creator',
                  effectiveDate: periodEndFromSubscription(confirmed),
                  amountPaid: invoice.amount_paid,
                  currency: invoice.currency,
                });
              } catch (emailError) {
                // Payment and access must not be rolled back because an email
                // provider is temporarily unavailable. Log it for investigation.
                console.error('Creator upgrade confirmation email failed:', emailError);
              }
            }

            return NextResponse.json({
              changed: true,
              charged: true,
              amountCharged: invoice.amount_paid,
              currency: invoice.currency,
              plan,
              renewalUnchanged: true,
              url: '/account?plan=upgraded',
            });
          }

          return NextResponse.json({
            error: 'Use Manage billing to schedule your downgrade. Creator access remains active until the end of the paid billing period.',
            manageBilling: true,
          }, { status: 409 });
        }
      } catch (error) {
        console.warn('Existing subscription could not be reused:', error);
        throw error;
      }
    }

    let customerId = String(member.stripeCustomerId || '');
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: name || undefined,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await memberRef.set({
        uid,
        email,
        name,
        stripeCustomerId: customerId,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: `${siteUrl}/account?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/membership?subscription=cancelled`,
      metadata: { firebaseUid: uid, plan },
      subscription_data: { metadata: { firebaseUid: uid, plan } },
    });

    if (!session.url) return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription checkout failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
