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

export async function recordInvoicePaid(invoice: Stripe.Invoice) {
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
  if(invoice.billing_reason==='subscription_cycle')await recordAnalyticsEvent({eventType:'membership_renewed',entityType:'subscription',entityId:String(data.plan||'subscription'),memberId:member.id,plan:String(data.plan||''),revenueCents:invoice.amount_paid||0,currency:invoice.currency,metadata:{status:'paid'}});
}
