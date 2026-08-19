import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

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

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function sendReport(subject: string, url: string, changed: number, deleted: number) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  const from = process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <info@aureonmusicgroup.com>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: ['info@aureonmusicgroup.com'],
      subject,
      text: `Daily subscriber report. ${changed} subscriber records changed/created and ${deleted} accounts deleted in the previous 24 hours. Download: ${url}`,
      html: `<div style="background:#050505;padding:32px;color:#f5f1e8;font-family:Arial"><h1>${subject}</h1><p>${changed} subscriber records created or updated · ${deleted} accounts deleted in the previous 24 hours.</p><a href="${url}" style="padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700">Download spreadsheet</a></div>`,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = Date.now();
  const since = now - 86_400_000;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

  const [memberSnapshot, deletionSnapshot] = await Promise.all([
    adminFirestore.collection('members').limit(10000).get(),
    adminFirestore.collection('accountDeletions').where('status', '==', 'completed').limit(5000).get(),
  ]);

  const members = memberSnapshot.docs
    .map(document => ({ id: document.id, ...document.data() } as any))
    .filter(member => millis(member.updatedAt || member.createdAt || member.subscriptionUpdatedAt) >= since);

  const deletions = deletionSnapshot.docs
    .map(document => ({ id: document.id, ...document.data() } as any))
    .filter(deletion => millis(deletion.completedAt || deletion.requestedAt) >= since);

  const rows: unknown[][] = [[
    'Event', 'Name', 'Email', 'Plan', 'Subscription status', 'Stripe customer', 'Stripe subscription',
    'Cancel at period end', 'Period end', 'Created/updated/deleted',
  ]];

  for (const member of members) {
    rows.push([
      'Created / updated',
      member.name || member.fullName || '',
      member.email || '',
      member.plan || '',
      member.subscriptionStatus || member.status || '',
      member.stripeCustomerId || '',
      member.stripeSubscriptionId || '',
      member.cancelAtPeriodEnd ? 'Yes' : 'No',
      member.currentPeriodEnd?.toDate?.()?.toISOString?.() || '',
      new Date(millis(member.updatedAt || member.createdAt || member.subscriptionUpdatedAt)).toISOString(),
    ]);
  }

  for (const deletion of deletions) {
    rows.push([
      'Account deleted',
      deletion.name || '',
      deletion.email || '',
      deletion.plan || '',
      deletion.subscriptionStatus || '',
      deletion.stripeCustomerId || '',
      deletion.stripeSubscriptionId || '',
      'N/A',
      '',
      new Date(millis(deletion.completedAt || deletion.requestedAt)).toISOString(),
    ]);
  }

  const subject = `Daly Subs -${date}.csv`;
  const reportRef = adminFirestore.collection('fulfilmentDigests').doc();
  await reportRef.set({
    createdAt: new Date(),
    csv: rows.map(row => row.map(csvCell).join(',')).join('\n'),
    permanent: true,
    fileName: subject,
    reportType: 'subscribers',
    subscriberChanges: members.length,
    accountDeletions: deletions.length,
  });

  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
  await sendReport(subject, `${base}/api/fulfilment-digest/${reportRef.id}`, members.length, deletions.length);

  return NextResponse.json({ ok: true, subscribers: members.length, deletions: deletions.length, sent: true });
}
