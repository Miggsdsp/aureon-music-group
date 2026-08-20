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

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const now = Date.now();
  const date = dublinReportDate(now);
  const subject = `Sold songs Orders-${date}.csv`;
  const snapshot = await adminFirestore.collection('orders').where('status','==','paid').limit(5000).get();
  const orders = snapshot.docs.map(document => ({ id:document.id, ...document.data() } as any))
    .filter(order => Array.isArray(order.songs) && order.songs.length && isWithinPrevious24Hours(order.paidAt || order.createdAt, now))
    .sort((a,b) => millis(a.paidAt || a.createdAt) - millis(b.paidAt || b.createdAt));

  const rows: unknown[][] = [['Date','Time','Order Number','Customer Name','Email','Song','Artist','Quantity','Unit Price','Line Total','Order Total','Currency','Payment Status','Stripe Payment Intent']];
  let count = 0;
  let value = 0;
  for (const order of orders) {
    const paid = new Date(millis(order.paidAt || order.createdAt));
    for (const song of order.songs || []) {
      const quantity = Math.max(1, Number(song.quantity || 1));
      const unitAmount = Number(song.unitAmount || 0);
      const lineTotal = unitAmount * quantity;
      count += quantity;
      value += lineTotal;
      rows.push([
        paid.toLocaleDateString('en-IE',{timeZone:'Europe/Dublin'}), paid.toLocaleTimeString('en-IE',{timeZone:'Europe/Dublin'}),
        order.orderNumber || order.id, order.customerName || '', order.customerEmail || '', song.title || '', song.artist || '', quantity,
        (unitAmount/100).toFixed(2), (lineTotal/100).toFixed(2), (Number(order.amountTotal||0)/100).toFixed(2), String(order.currency||'EUR').toUpperCase(),
        order.paymentStatus || order.status || '', order.stripePaymentIntentId || '',
      ]);
    }
  }

  const claimed = await claimDailyReport({ reportType:'music-sales', date, fileName:subject, csv:makeCsv(rows), metadata:{ orderIds:orders.map(order=>order.id), songCount:count, songRevenueCents:value } });
  if (!claimed.claimed) return NextResponse.json({ ok:true, songs:count, sent:false, duplicate:true });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/,'');
  const url = `${base}/api/fulfilment-digest/${claimed.reportId}`;
  try {
    const sent = await sendDailyReportEmail({ reportType:'music-sales', date, subject, text:`Sold songs in previous 24 hours: ${count}. Revenue: €${(value/100).toFixed(2)}. Download: ${url}`, html:`<div style="background:#050505;padding:32px;color:#f5f1e8;font-family:Arial"><h1>${subject}</h1><p>${count} songs sold · €${(value/100).toFixed(2)}</p><p><a href="${url}" style="padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700">Download spreadsheet</a></p>${count ? '' : '<p>No individual songs were sold in the previous 24 hours.</p>'}</div>` });
    await markDailyReportSent(claimed.ref, sent.emailId);
    return NextResponse.json({ ok:true, songs:count, sent:true, resendEmailId:sent.emailId });
  } catch (error) {
    await markDailyReportFailed(claimed.ref, error);
    throw error;
  }
}
