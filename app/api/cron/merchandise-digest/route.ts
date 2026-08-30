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
function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[character] || character));
}
function address(addressValue: any) {
  return addressValue ? [addressValue.line1,addressValue.line2,addressValue.city,addressValue.region,addressValue.postalCode,addressValue.country].filter(Boolean).join(', ') : 'Not captured';
}
function stripeCustomerId(order: any) {
  return String(order.stripeCustomerId || order.customerStripeId || '');
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = Date.now();
  const date = dublinReportDate(now);
  const subject = `Merch Orders-${date}.csv`;
  const snapshot = await adminFirestore.collection('orders').where('status','==','paid').limit(5000).get();
  const orders = snapshot.docs.map(document => ({ id: document.id, ...document.data() } as any))
    .filter(order => Array.isArray(order.products) && order.products.length && isWithinPrevious24Hours(order.paidAt || order.createdAt, now))
    .sort((a,b) => millis(a.paidAt || a.createdAt) - millis(b.paidAt || b.createdAt));

  const rows: unknown[][] = [[
    'Purchase Type','Member / User ID','Date','Time','Order Number','Customer Name','Email','Phone',
    'Delivery Address','Address Line 1','Address Line 2','City','Region','Postal Code','Country',
    'Product','Product ID','Quantity','Size','Colour / Specification','Unit Price','Line Total','Order Total','Currency',
    'Payment Status','Fulfilment Status','Stripe Customer','Stripe Payment Intent','Stripe Checkout Session','Inventory Reservation'
  ]];
  let units = 0;
  let merchandiseValue = 0;
  for (const order of orders) {
    const paid = new Date(millis(order.paidAt || order.createdAt));
    const delivery = order.deliveryAddress || {};
    for (const product of order.products || []) {
      const quantity = Math.max(1, Number(product.quantity || 1));
      const unitAmount = Number(product.unitAmount ?? product.priceCents ?? 0);
      const lineTotal = unitAmount * quantity;
      units += quantity;
      merchandiseValue += lineTotal;
      rows.push([
        'Merchandise', order.memberUid || order.uid || order.firebaseUid || '',
        paid.toLocaleDateString('en-IE',{timeZone:'Europe/Dublin'}), paid.toLocaleTimeString('en-IE',{timeZone:'Europe/Dublin'}),
        order.orderNumber || order.id, order.customerName || '', order.customerEmail || '', order.customerPhone || '', address(delivery),
        delivery.line1 || '', delivery.line2 || '', delivery.city || order.customerCity || '', delivery.region || '', delivery.postalCode || order.customerPostalCode || '', delivery.country || order.customerCountry || order.country || '',
        product.name || product.title || '', product.id || product.productId || '', quantity, product.size || '', product.colour || product.specification || '',
        (unitAmount / 100).toFixed(2), (lineTotal / 100).toFixed(2), (Number(order.amountTotal || 0) / 100).toFixed(2),
        String(order.currency || 'EUR').toUpperCase(), order.paymentStatus || order.status || '', order.fulfilmentStatus || 'awaiting_fulfilment',
        stripeCustomerId(order), order.stripePaymentIntentId || '', order.stripeCheckoutSessionId || order.id, order.inventoryReservationId || '',
      ]);
    }
  }

  const csv = makeCsv(rows);
  const claimed = await claimDailyReport({ reportType:'merchandise', date, fileName:subject, csv, metadata:{ orderIds:orders.map(order=>order.id), orderCount:orders.length, unitCount:units, merchandiseValueCents:merchandiseValue } });
  if (!claimed.claimed) return NextResponse.json({ ok:true, orders:orders.length, sent:false, duplicate:true });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/,'');
  const url = `${base}/api/fulfilment-digest/${claimed.reportId}`;
  const details = orders.map(order => `<div style="padding:18px 0;border-bottom:1px solid #42371e"><strong>${esc(order.orderNumber||order.id)}</strong> — ${esc(order.customerName)}<br>${esc(order.customerEmail)} · ${esc(order.customerPhone||'No phone')}<br>${esc(address(order.deliveryAddress))}<ul>${(order.products||[]).map((product:any)=>`<li>${esc(product.name)} × ${Number(product.quantity||1)}${product.size?` · Size ${esc(product.size)}`:''}${product.colour?` · ${esc(product.colour)}`:''}</li>`).join('')}</ul></div>`).join('');
  try {
    const sent = await sendDailyReportEmail({ reportType:'merchandise', date, subject, text:`Previous 24 hours merchandise report. Orders: ${orders.length}. Items: ${units}. Merchandise value: €${(merchandiseValue/100).toFixed(2)}. Download: ${url}`, html:`<div style="background:#050505;padding:32px;font-family:Arial;color:#f5f1e8"><h1>${subject}</h1><p>${orders.length} orders · ${units} items · €${(merchandiseValue/100).toFixed(2)}</p><p><a href="${esc(url)}" style="padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700">Download spreadsheet</a></p>${details || '<p>No merchandise orders were paid in the previous 24 hours.</p>'}</div>` });
    await markDailyReportSent(claimed.ref, sent.emailId);
    return NextResponse.json({ ok:true, orders:orders.length, sent:true, resendEmailId:sent.emailId });
  } catch (error) {
    await markDailyReportFailed(claimed.ref, error);
    throw error;
  }
}