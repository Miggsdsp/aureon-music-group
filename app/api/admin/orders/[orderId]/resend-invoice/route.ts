import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';

export const runtime = 'nodejs';
type Context = { params: Promise<{ orderId: string }> };

const money = (value: number, currency = 'EUR') => new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency.toUpperCase() }).format(value / 100);
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));

export async function POST(request: Request, context: Context) {
  try {
    const admin = await requireAdminApi(request);
    const { orderId } = await context.params;
    const orderRef = adminFirestore.collection('orders').doc(orderId);
    const snapshot = await orderRef.get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const order = snapshot.data() || {};
    if (String(order.status || order.paymentStatus || '').toLowerCase() !== 'paid') return NextResponse.json({ error: 'Only paid orders can receive an invoice.' }, { status: 409 });
    const email = String(order.customerEmail || '').trim();
    if (!email) return NextResponse.json({ error: 'This order has no customer email.' }, { status: 409 });

    const items = [...(Array.isArray(order.songs) ? order.songs : []), ...(Array.isArray(order.items) ? order.items : [])];
    const itemRows = items.map((item: any) => {
      const name = escapeHtml(String(item.title || item.name || 'Aureon item'));
      const quantity = Number(item.quantity || 1);
      const unit = Number(item.unitAmount || item.price || 0);
      return `<tr><td style="padding:10px;border-bottom:1px solid #ddd">${name}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:center">${quantity}</td><td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(money(unit, order.currency || 'EUR'))}</td></tr>`;
    }).join('');

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Transactional email is not configured.' }, { status: 503 });
    const orderNumber = String(order.orderNumber || orderId);
    const total = money(Number(order.amountTotal || 0), order.currency || 'EUR');
    const paidDate = order.paidAt?.toDate?.() || order.createdAt?.toDate?.() || new Date();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <members@aureonmusicgroup.com>',
        to: [email],
        subject: `Aureon invoice — ${orderNumber}`,
        text: `Aureon Music Group invoice\nOrder: ${orderNumber}\nPaid: ${paidDate.toLocaleDateString('en-IE')}\nTotal: ${total}`,
        html: `<div style="background:#050505;padding:32px;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;background:#fff;color:#111;padding:34px"><p style="letter-spacing:3px;color:#a48231">AUREON MUSIC GROUP</p><h1>Invoice</h1><p><strong>Order:</strong> ${escapeHtml(orderNumber)}<br><strong>Paid:</strong> ${escapeHtml(paidDate.toLocaleDateString('en-IE'))}<br><strong>Customer:</strong> ${escapeHtml(String(order.customerName || email))}</p><table style="width:100%;border-collapse:collapse;margin-top:24px"><thead><tr><th style="text-align:left;padding:10px">Item</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>${itemRows}</tbody></table><p style="font-size:22px;text-align:right"><strong>Total: ${escapeHtml(total)}</strong></p><p style="color:#666">Payment processed securely by Stripe.</p></div></div>`,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    await orderRef.set({ invoiceResentAt: FieldValue.serverTimestamp(), invoiceResentBy: admin.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Invoice resend failed:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
    if (code === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    return NextResponse.json({ error: 'The invoice could not be resent.' }, { status: 500 });
  }
}
