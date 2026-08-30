import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { claimDailyReport, dublinReportDate, isWithinPrevious24Hours, makeCsv, markDailyReportFailed, markDailyReportSent, sendDailyReportEmail } from '@/lib/daily-report';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}
function millis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return new Date(value).getTime() || 0;
}
function iso(value: any) {
  const timestamp = millis(value);
  return timestamp ? new Date(timestamp).toISOString() : '';
}
function lower(value: unknown) {
  return String(value || '').trim().toLowerCase();
}
function amountEuros(value: unknown) {
  const cents = Number(value);
  return Number.isFinite(cents) && cents !== 0 ? (cents / 100).toFixed(2) : '';
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const now = Date.now();
  const date = dublinReportDate(now);
  const subject = `Daly Subs -${date}.csv`;

  const [memberSnapshot, eventSnapshot, analyticsSnapshot, deletionSnapshot] = await Promise.all([
    adminFirestore.collection('members').limit(10000).get(),
    adminFirestore.collection('subscriptionEvents').limit(10000).get(),
    adminFirestore.collection('analyticsEvents').limit(10000).get(),
    adminFirestore.collection('accountDeletions').where('status','==','completed').limit(5000).get(),
  ]);

  const memberRows = memberSnapshot.docs.map(document => ({ id:document.id, ...document.data() } as any));
  const membersById = new Map(memberRows.map(member => [String(member.id), member]));
  const membersByEmail = new Map(memberRows.filter(member => member.email).map(member => [lower(member.email), member]));
  const membersByCustomer = new Map(memberRows.filter(member => member.stripeCustomerId).map(member => [String(member.stripeCustomerId), member]));
  const membersBySubscription = new Map(memberRows.filter(member => member.stripeSubscriptionId).map(member => [String(member.stripeSubscriptionId), member]));

  const resolveMember = (record: any) => {
    const id = String(record.uid || record.memberId || record.firebaseUid || '');
    if (id && membersById.has(id)) return membersById.get(id) || {};
    const email = lower(record.email || record.customerEmail);
    if (email && membersByEmail.has(email)) return membersByEmail.get(email) || {};
    const customer = String(record.stripeCustomerId || record.customerId || '');
    if (customer && membersByCustomer.has(customer)) return membersByCustomer.get(customer) || {};
    const subscription = String(record.stripeSubscriptionId || record.subscriptionId || '');
    if (subscription && membersBySubscription.has(subscription)) return membersBySubscription.get(subscription) || {};
    return {};
  };

  const events = eventSnapshot.docs.map(document => ({ id:document.id, ...document.data() } as any))
    .filter(event => isWithinPrevious24Hours(event.createdAt, now));
  const paymentEvents = analyticsSnapshot.docs.map(document => ({ id:document.id, ...document.data() } as any))
    .filter(event => ['membership_renewed','membership_payment_failed'].includes(String(event.eventType || '')) && isWithinPrevious24Hours(event.createdAt || event.receivedAt, now));
  const deletions = deletionSnapshot.docs.map(document => ({ id:document.id, ...document.data() } as any))
    .filter(deletion => isWithinPrevious24Hours(deletion.completedAt || deletion.requestedAt, now));

  const rows: unknown[][] = [[
    'Purchase Type','Event','Date / Time','Member / User ID','Name','Email','Phone','Country','Plan','Subscription Status','Active','Source',
    'Amount','Currency','Stripe Customer','Stripe Subscription','Stripe Invoice / Reference','Cancel At Period End','Period End'
  ]];

  for (const event of events) {
    const member = resolveMember(event);
    rows.push([
      'Subscription', 'Subscription event', iso(event.createdAt), event.uid || event.memberId || member.id || '',
      event.name || member.name || member.fullName || '', event.email || member.email || '', event.phone || member.phone || '', member.country || member.customerCountry || '',
      event.plan || member.plan || '', event.status || member.subscriptionStatus || '', event.active === true ? 'Yes' : 'No', event.source || '',
      amountEuros(event.amountPaid ?? event.amountTotal ?? event.revenueCents), String(event.currency || '').toUpperCase(),
      event.stripeCustomerId || member.stripeCustomerId || '', event.stripeSubscriptionId || member.stripeSubscriptionId || '', event.invoiceId || event.entityId || '',
      member.cancelAtPeriodEnd ? 'Yes' : 'No', iso(member.currentPeriodEnd),
    ]);
  }

  for (const event of paymentEvents) {
    const member = resolveMember(event);
    rows.push([
      'Subscription', event.eventType === 'membership_renewed' ? 'Renewal paid' : 'Payment failed', iso(event.createdAt || event.receivedAt), event.memberId || member.id || '',
      member.name || member.fullName || '', member.email || '', member.phone || '', member.country || member.customerCountry || '', event.plan || member.plan || '', member.subscriptionStatus || '',
      member.subscriptionActive === true ? 'Yes' : 'No', event.eventType || '', amountEuros(event.revenueCents), String(event.currency || 'EUR').toUpperCase(),
      member.stripeCustomerId || '', member.stripeSubscriptionId || '', event.entityId || '', member.cancelAtPeriodEnd ? 'Yes' : 'No', iso(member.currentPeriodEnd),
    ]);
  }

  for (const deletion of deletions) {
    rows.push([
      'Subscription', 'Account deleted', iso(deletion.completedAt || deletion.requestedAt), deletion.uid || deletion.memberId || '', deletion.name || '', deletion.email || '', deletion.phone || '', deletion.country || '',
      deletion.plan || '', deletion.subscriptionStatus || '', 'No', 'account_deleted', '', '', deletion.stripeCustomerId || '', deletion.stripeSubscriptionId || '', '', 'N/A', '',
    ]);
  }

  rows.slice(1).sort((a,b) => String(a[2]).localeCompare(String(b[2])));

  const totalEvents = events.length + paymentEvents.length + deletions.length;
  const claimed = await claimDailyReport({ reportType:'subscribers', date, fileName:subject, csv:makeCsv(rows), metadata:{ subscriptionEvents:events.length, paymentEvents:paymentEvents.length, accountDeletions:deletions.length } });
  if (!claimed.claimed) return NextResponse.json({ ok:true, events:totalEvents, sent:false, duplicate:true });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/,'');
  const url = `${base}/api/fulfilment-digest/${claimed.reportId}`;
  try {
    const sent = await sendDailyReportEmail({ reportType:'subscribers', date, subject, text:`Daily subscription report for the previous 24 hours. Subscription events: ${events.length}. Payment events: ${paymentEvents.length}. Accounts deleted: ${deletions.length}. Download: ${url}`, html:`<div style="background:#050505;padding:32px;color:#f5f1e8;font-family:Arial"><h1>${subject}</h1><p>${events.length} subscription events · ${paymentEvents.length} payment events · ${deletions.length} accounts deleted</p><p><a href="${url}" style="padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700">Download spreadsheet</a></p>${totalEvents ? '' : '<p>No subscription, payment or account-deletion events were recorded in the previous 24 hours.</p>'}</div>` });
    await markDailyReportSent(claimed.ref, sent.emailId);
    return NextResponse.json({ ok:true, events:totalEvents, sent:true, resendEmailId:sent.emailId });
  } catch (error) {
    await markDailyReportFailed(claimed.ref, error);
    throw error;
  }
}