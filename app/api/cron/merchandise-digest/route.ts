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
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}

function addressText(address: any) {
  if (!address) return 'Not captured';
  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(', ');
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildCsv(orders: any[]) {
  const rows = [['Date','Time','Order','Customer','Email','Phone','Delivery address','Product','Quantity','Size','Colour / specification','Order total','Payment','Fulfilment']];
  for (const order of orders) {
    const date = new Date(millis(order.paidAt || order.createdAt));
    for (const product of order.products || []) rows.push([
      date.toLocaleDateString('en-IE', { timeZone: 'Europe/Dublin' }),
      date.toLocaleTimeString('en-IE', { timeZone: 'Europe/Dublin' }),
      order.orderNumber || order.id,
      order.customerName || '', order.customerEmail || '', order.customerPhone || '', addressText(order.deliveryAddress),
      product.name || product.title || '', String(product.quantity || 1), product.size || '', product.colour || product.specification || '',
      `€${(Number(order.amountTotal || 0) / 100).toFixed(2)}`, order.paymentStatus || order.status || '', order.fulfilmentStatus || 'awaiting_fulfilment'
    ]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

async function sendDigest(to: string, orders: any[], downloadUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const from = process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <info@aureonmusicgroup.com>';
  const itemCount = orders.reduce((sum, order) => sum + (order.products || []).reduce((n: number, p: any) => n + Number(p.quantity || 1), 0), 0);
  const revenue = orders.reduce((sum, order) => sum + Number(order.amountTotal || 0), 0);
  const orderHtml = orders.map(order => `<div style="padding:18px 0;border-bottom:1px solid #42371e"><strong>${escapeHtml(order.orderNumber || order.id)}</strong> — ${escapeHtml(order.customerName)}<br><span style="color:#bbb">${escapeHtml(order.customerEmail)} · ${escapeHtml(order.customerPhone || 'No phone')}</span><br><span>${escapeHtml(addressText(order.deliveryAddress))}</span><ul>${(order.products || []).map((p:any)=>`<li>${escapeHtml(p.name)} × ${Number(p.quantity || 1)}${p.size ? ` · Size ${escapeHtml(p.size)}` : ''}${p.colour ? ` · ${escapeHtml(p.colour)}` : ''}</li>`).join('')}</ul></div>`).join('');
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify({
    from, to:[to], subject:`Aureon daily merchandise orders — ${orders.length} orders / ${itemCount} items`,
    text:`Aureon merchandise fulfilment report for the previous 24 hours.\nOrders: ${orders.length}\nItems: ${itemCount}\nOrder value: €${(revenue/100).toFixed(2)}\n\nDownload spreadsheet: ${downloadUrl}`,
    html:`<div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8"><div style="max-width:760px;margin:auto"><p style="letter-spacing:3px;color:#d8b85f">AUREON MUSIC GROUP</p><h1>Daily merchandise fulfilment</h1><p>Previous 24 hours: <strong>${orders.length} orders</strong> · <strong>${itemCount} items</strong> · <strong>€${(revenue/100).toFixed(2)}</strong> order value.</p><p><a href="${escapeHtml(downloadUrl)}" style="display:inline-block;padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700">Download fulfilment spreadsheet</a></p>${orderHtml}</div></div>`
  })});
  if (!response.ok) throw new Error(`Daily digest email failed: ${response.status} ${await response.text()}`);
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = Date.now(); const since = now - 24 * 60 * 60 * 1000;
  const snapshot = await adminFirestore.collection('orders').where('status','==','paid').limit(5000).get();
  const orders = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() } as any)).filter(order => Array.isArray(order.products) && order.products.length && millis(order.paidAt || order.createdAt) >= since).sort((a,b)=>millis(a.paidAt||a.createdAt)-millis(b.paidAt||b.createdAt));
  if (!orders.length) {
    await adminFirestore.collection('fulfilmentDigestRuns').add({ orderCount:0, itemCount:0, sent:false, reason:'no_orders', completedAt:new Date() });
    return NextResponse.json({ ok:true, orders:0, sent:false });
  }
  const runRef = adminFirestore.collection('fulfilmentDigests').doc();
  const csv = buildCsv(orders);
  await runRef.set({ createdAt:new Date(), expiresAt:new Date(now + 7*24*60*60*1000), orderIds:orders.map(o=>o.id), csv, orderCount:orders.length });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/,'');
  const downloadUrl = `${siteUrl}/api/fulfilment-digest/${runRef.id}`;
  const recipient = 'info@aureonmusicgroup.com';
  await sendDigest(recipient, orders, downloadUrl);
  await adminFirestore.collection('fulfilmentDigestRuns').add({ digestId:runRef.id, recipient, orderCount:orders.length, sent:true, completedAt:new Date() });
  return NextResponse.json({ ok:true, orders:orders.length, sent:true });
}
