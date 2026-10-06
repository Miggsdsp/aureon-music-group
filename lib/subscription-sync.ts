import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { recordAnalyticsEvent } from '@/lib/analytics-server';
import { rewardReferralConversion } from '@/lib/referrals';

export type AureonPlan = 'listener' | 'creator';

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const value = subscription.items.data[0]?.current_period_end;
  return value ? new Date(value * 1000) : null;
}

export function getSubscriptionPlan(subscription: Stripe.Subscription): AureonPlan {
  const metadataPlan = String(subscription.metadata?.plan || '').toLowerCase();
  if (metadataPlan === 'creator' || metadataPlan === 'listener') return metadataPlan;
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId === process.env.STRIPE_CREATOR_PRICE_ID) return 'creator';
  return 'listener';
}

export async function resolveFirebaseUid(subscription: Stripe.Subscription) {
  const metadataUid = String(subscription.metadata?.firebaseUid || '');
  if (metadataUid) return metadataUid;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const match = await adminFirestore.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
  return match.empty ? '' : match.docs[0].id;
}

function invoicePaidAt(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as Stripe.Invoice & { status_transitions?: { paid_at?: number | null } | null };
  const paidAt = invoiceAny.status_transitions?.paid_at || invoice.created;
  return paidAt ? new Date(paidAt * 1000) : new Date();
}

function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as Stripe.Invoice & { payment_intent?: string | Stripe.PaymentIntent | null };
  const value = invoiceAny.payment_intent;
  return typeof value === 'string' ? value : value?.id || '';
}

async function resolveInvoiceMember(invoice: Stripe.Invoice, subscription: Stripe.Subscription | null) {
  if (subscription) {
    const uid = await resolveFirebaseUid(subscription);
    if (uid) return { uid, data: {}, ref: adminFirestore.collection('members').doc(uid) };
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;
  const members = await adminFirestore.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (members.empty) return null;
  const member = members.docs[0];
  return { uid: member.id, data: member.data() || {}, ref: member.ref };
}

export async function recordSubscriptionPayment(invoice: Stripe.Invoice, subscription: Stripe.Subscription | null, source: string) {
  if (!invoice.id) return { recorded: false, reason: 'missing_invoice_id' };
  const invoiceAny = invoice as Stripe.Invoice & { amount_refunded?: number | null };
  const amountPaid = Number(invoice.amount_paid || 0);
  if (String(invoice.status || '').toLowerCase() !== 'paid') return { recorded: false, reason: 'invoice_not_paid' };
  if (amountPaid <= 0) return { recorded: false, reason: 'no_paid_amount' };

  const resolved = await resolveInvoiceMember(invoice, subscription);
  if (!resolved) return { recorded: false, reason: 'member_not_found' };

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || '';
  const plan = subscription ? getSubscriptionPlan(subscription) : (String(resolved.data.plan || '') as AureonPlan || 'listener');
  const subscriptionId = subscription?.id || String((invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription || '');
  const paymentIntentId = invoicePaymentIntentId(invoice);
  const paidAt = invoicePaidAt(invoice);
  const amountRefunded = Number(invoiceAny.amount_refunded || 0);
  const status = amountRefunded > 0 && amountRefunded >= amountPaid ? 'refunded' : 'paid';

  const payload = {
    kind: 'subscription',
    purchaseType: 'subscription',
    status,
    paymentStatus: 'paid',
    uid: resolved.uid,
    memberId: resolved.uid,
    plan,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    stripePaymentIntentId: paymentIntentId,
    billingReason: invoice.billing_reason || '',
    source,
    amountPaid,
    amountTotal: amountPaid,
    amountRefunded,
    currency: (invoice.currency || 'eur').toLowerCase(),
    paidAt,
    recordedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await adminFirestore.collection('subscriptionPayments').doc(invoice.id).set(payload, { merge: true });
  await adminFirestore.collection('payments').doc(`subscription_${invoice.id}`).set({
    ...payload,
    amount: amountPaid,
    orderId: '',
    orderNumber: '',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (amountRefunded > 0) {
    await adminFirestore.collection('refunds').doc(`subscription_${invoice.id}`).set({
      kind: 'subscription',
      purchaseType: 'subscription',
      status: 'refunded',
      memberId: resolved.uid,
      plan,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      amountRefunded,
      currency: (invoice.currency || 'eur').toLowerCase(),
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return { recorded: true, invoiceId: invoice.id, amountPaid, plan };
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, source: string) {
  const uid = await resolveFirebaseUid(subscription);
  if (!uid) throw new Error(`Unable to resolve Firebase member for Stripe subscription ${subscription.id}.`);
  const plan = getSubscriptionPlan(subscription);
  const status = subscription.status;
  const active = status === 'active' || status === 'trialing';
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const monthlyDownloadLimit = active && plan === 'creator' ? 5 : 0;
  const memberRef = adminFirestore.collection('members').doc(uid);
  await memberRef.set({ uid, plan, subscriptionStatus: status, subscriptionActive: active, stripeCustomerId: customerId, stripeSubscriptionId: subscription.id, currentPeriodEnd: getSubscriptionPeriodEnd(subscription), cancelAtPeriodEnd: subscription.cancel_at_period_end, creatorLicenseActive: plan === 'creator' && active, monthlyDownloadLimit, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await adminFirestore.collection('subscriptionEvents').add({uid,memberId:uid,purchaseType:'subscription',plan,status,active,source,cancelAtPeriodEnd:subscription.cancel_at_period_end,currentPeriodEnd:getSubscriptionPeriodEnd(subscription),createdAt:FieldValue.serverTimestamp()});

  if (active) await rewardReferralConversion(uid);
  if(source==='customer.subscription.deleted'||status==='canceled')await recordAnalyticsEvent({eventType:'membership_cancelled',entityType:'subscription',entityId:plan,memberId:uid,plan,metadata:{status,cancelAtPeriodEnd:subscription.cancel_at_period_end}});
  return { uid, plan, status, active, customerId };
}

export async function markInvoicePaymentFailure(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const members = await adminFirestore.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (members.empty) return;
  const member = members.docs[0];
  const data = member.data() || {};
  await member.ref.set({ subscriptionStatus: 'past_due', subscriptionActive: false, creatorLicenseActive: false, monthlyDownloadLimit: 0, lastPaymentFailureAt: FieldValue.serverTimestamp(), lastFailedInvoiceId: invoice.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await recordAnalyticsEvent({eventType:'membership_payment_failed',entityType:'subscription',entityId:String(data.plan||'subscription'),memberId:member.id,revenueCents:0,currency:invoice.currency,plan:String(data.plan||''),metadata:{status:'failed'}});
}

export async function recordInvoicePaid(invoice: Stripe.Invoice, subscription: Stripe.Subscription | null = null) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const members = await adminFirestore.collection('members').where('stripeCustomerId', '==', customerId).limit(1).get();
  if (members.empty) return;
  const member = members.docs[0];
  const data = member.data() || {};
  const resetDownloads = invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create';
  await member.ref.set({
    ...(resetDownloads ? {
      monthlyDownloadsUsed: 0,
      monthlyDownloadedSongIds: [],
      monthlyDownloadCycle: `invoice-${invoice.id}`,
      downloadCycleResetAt: FieldValue.serverTimestamp(),
    } : {}),
    lastInvoicePaidAt: FieldValue.serverTimestamp(),
    lastPaidInvoiceId: invoice.id,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await recordSubscriptionPayment(invoice, subscription, 'invoice.paid');
  if(invoice.billing_reason==='subscription_cycle')await recordAnalyticsEvent({eventType:'membership_renewed',entityType:'subscription',entityId:String(data.plan||'subscription'),memberId:member.id,plan:String(data.plan||''),revenueCents:invoice.amount_paid||0,currency:invoice.currency,metadata:{status:'paid'}});
}
