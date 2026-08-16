type DownloadEmailItem = {
  title: string;
  artist?: string;
  downloadUrl: string;
};

type PurchaseEmail = {
  to: string;
  customerName?: string;
  orderNumber: string;
  items: DownloadEmailItem[];
};

type ReceiptItem = {
  name: string;
  quantity: number;
  unitAmount: number;
  size?: string;
  colour?: string;
  downloadUrl?: string;
};

type PurchaseReceiptEmail = {
  to: string;
  customerName?: string;
  orderNumber: string;
  amountTotal: number;
  currency?: string;
  items: ReceiptItem[];
  deliveryAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  } | null;
};

type FulfilmentNotification = PurchaseReceiptEmail & {
  customerEmail: string;
  customerPhone?: string;
  paidAt?: Date;
};

export type SubscriptionEmailKind =
  | 'confirmed'
  | 'upgraded'
  | 'downgraded'
  | 'cancellation-scheduled'
  | 'cancelled'
  | 'payment-failed'
  | 'payment-restored'
  | 'renewal-paid';

type SubscriptionEmail = {
  to: string;
  customerName?: string;
  kind: SubscriptionEmailKind;
  plan?: 'listener' | 'creator';
  effectiveDate?: Date | null;
  amountPaid?: number | null;
  currency?: string;
};

function emailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <members@aureonmusicgroup.com>',
  };
}

async function sendEmail(payload: { to: string; subject: string; text: string; html: string }) {
  const { apiKey, from } = emailConfig();
  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured. Transactional email was not sent.');
    return { sent: false, reason: 'not-configured' } as const;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, text: payload.text, html: payload.html }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${details}`);
  }
  return { sent: true } as const;
}

function formatMoney(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: String(currency || 'EUR').toUpperCase() }).format(Number(cents || 0) / 100);
}

function addressLines(address?: PurchaseReceiptEmail['deliveryAddress']) {
  if (!address) return [];
  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country].map(value => String(value || '').trim()).filter(Boolean);
}

export async function sendPurchaseReceiptEmail(input: PurchaseReceiptEmail) {
  const itemHtml = input.items.map(item => {
    const specs = [item.size ? `Size ${item.size}` : '', item.colour || ''].filter(Boolean).join(' · ');
    const download = item.downloadUrl ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(item.downloadUrl)}" style="color:#d8b85f;font-weight:700;">Download purchased track</a></p>` : '';
    return `<tr><td style="padding:12px 8px;border-bottom:1px solid #333;">${escapeHtml(item.name)}${specs ? `<br><small style="color:#aaa;">${escapeHtml(specs)}</small>` : ''}${download}</td><td style="padding:12px 8px;border-bottom:1px solid #333;text-align:center;">${item.quantity}</td><td style="padding:12px 8px;border-bottom:1px solid #333;text-align:right;">${escapeHtml(formatMoney(item.unitAmount * item.quantity, input.currency))}</td></tr>`;
  }).join('');
  const address = addressLines(input.deliveryAddress);
  const addressHtml = address.length ? `<div style="margin-top:24px;padding:18px;border:1px solid #5b4925;"><strong>Delivery address</strong><p style="line-height:1.6;margin:10px 0 0;">${address.map(escapeHtml).join('<br>')}</p></div>` : '';
  const textItems = input.items.map(item => `${item.quantity} × ${item.name}${item.size ? ` · Size ${item.size}` : ''}${item.colour ? ` · ${item.colour}` : ''} — ${formatMoney(item.unitAmount * item.quantity, input.currency)}${item.downloadUrl ? `\nDownload: ${item.downloadUrl}` : ''}`).join('\n');

  return sendEmail({
    to: input.to,
    subject: `Aureon order confirmation & receipt — ${input.orderNumber}`,
    text: `Thank you for your Aureon purchase.\n\nOrder: ${input.orderNumber}\nTotal paid: ${formatMoney(input.amountTotal, input.currency)}\n\n${textItems}${address.length ? `\n\nDelivery address:\n${address.join('\n')}` : ''}\n\nWe will email you again if your merchandise order requires a shipping update.`,
    html: `<div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8;"><div style="max-width:680px;margin:0 auto;border:1px solid #5b4925;padding:34px;background:#0b0b0b;"><p style="letter-spacing:3px;color:#d8b85f;text-transform:uppercase;">Aureon Music Group</p><h1 style="font-size:30px;margin:12px 0 18px;">Order confirmed.</h1><p>Hello ${escapeHtml(input.customerName || 'Aureon customer')},</p><p>Thank you for your purchase. Your payment has been received successfully.</p><p><strong>Order reference:</strong> ${escapeHtml(input.orderNumber)}</p><table style="width:100%;border-collapse:collapse;margin-top:24px;color:#f5f1e8;"><thead><tr><th style="padding:10px 8px;text-align:left;border-bottom:1px solid #806a35;">Item</th><th style="padding:10px 8px;text-align:center;border-bottom:1px solid #806a35;">Qty</th><th style="padding:10px 8px;text-align:right;border-bottom:1px solid #806a35;">Amount</th></tr></thead><tbody>${itemHtml}</tbody></table><p style="font-size:20px;text-align:right;margin-top:22px;"><strong>Total paid: ${escapeHtml(formatMoney(input.amountTotal, input.currency))}</strong></p>${addressHtml}<p style="margin-top:26px;color:#aaa;font-size:13px;">Keep this email as your purchase confirmation and receipt.</p></div></div>`,
  });
}

export async function sendFulfilmentOrderNotification(input: FulfilmentNotification) {
  const operationsEmail = process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (!operationsEmail) return { sent: false, reason: 'not-configured' } as const;
  const address = addressLines(input.deliveryAddress);
  const rows = input.items.map(item => `${item.quantity} × ${item.name}${item.size ? ` | Size: ${item.size}` : ''}${item.colour ? ` | Colour: ${item.colour}` : ''}`).join('\n');
  return sendEmail({
    to: operationsEmail,
    subject: `NEW MERCH ORDER — ${input.orderNumber} — dispatch required`,
    text: `A new paid merchandise order requires fulfilment.\n\nOrder: ${input.orderNumber}\nDate/time: ${(input.paidAt || new Date()).toLocaleString('en-IE')}\nCustomer: ${input.customerName || ''}\nEmail: ${input.customerEmail}\nPhone: ${input.customerPhone || ''}\nTotal: ${formatMoney(input.amountTotal, input.currency)}\n\nITEMS\n${rows}\n\nDELIVERY ADDRESS\n${address.join('\n') || 'Not captured'}\n\nOpen the Aureon admin fulfilment dashboard to process this order.`,
    html: `<div style="font-family:Arial,sans-serif;background:#080808;color:#f4f0e6;padding:30px;"><div style="max-width:680px;margin:auto;border:1px solid #806a35;padding:28px;"><h1 style="color:#d8b85f;">New merchandise order</h1><p><strong>${escapeHtml(input.orderNumber)}</strong></p><p>${escapeHtml(input.customerName || '')}<br>${escapeHtml(input.customerEmail)}<br>${escapeHtml(input.customerPhone || '')}</p><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;background:#111;padding:16px;">${escapeHtml(rows)}</pre><h3>Delivery address</h3><p>${address.map(escapeHtml).join('<br>') || 'Not captured'}</p><p><strong>Total: ${escapeHtml(formatMoney(input.amountTotal, input.currency))}</strong></p></div></div>`,
  });
}

export async function sendPurchaseDownloadEmail(input: PurchaseEmail) {
  const itemHtml = input.items.map(item => {
    const safeTitle = escapeHtml(item.title);
    const safeArtist = escapeHtml(item.artist || 'Aureon Music Group');
    const safeUrl = escapeHtml(item.downloadUrl);
    return `<div style="margin:0 0 22px;padding:20px;border:1px solid #c7a85a;background:#ffffff;color:#111111;"><div style="font-size:20px;font-weight:700;line-height:1.3;">${safeTitle}</div><div style="margin-top:5px;color:#666666;">${safeArtist}</div><div style="margin-top:18px;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 22px;background:#b9973f;color:#ffffff;text-decoration:none;font-weight:700;border-radius:2px;">Download your purchased song</a></div><p style="margin:16px 0 6px;color:#555555;font-size:13px;line-height:1.5;">Button not working? Copy and paste this secure link into your browser:</p><p style="margin:0;word-break:break-all;font-size:13px;line-height:1.5;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#8d7134;text-decoration:underline;">${safeUrl}</a></p></div>`;
  }).join('');
  const textItems = input.items.map(item => `${item.title}${item.artist ? ` — ${item.artist}` : ''}\nDownload link: ${item.downloadUrl}`).join('\n\n');

  return sendEmail({
    to: input.to,
    subject: `Your Aureon download is ready — ${input.orderNumber}`,
    text: `Your Aureon music is ready.\n\nOrder reference: ${input.orderNumber}\n\nEach purchased song can be downloaded once only.\n\n${textItems}\n\nIf a technical problem prevents your download, contact Aureon support and quote your order reference.`,
    html: `<div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8;"><div style="max-width:640px;margin:0 auto;"><p style="letter-spacing:3px;color:#d8b85f;text-transform:uppercase;">Aureon Music Group</p><h1 style="font-size:32px;margin:10px 0 18px;">Your music is ready.</h1><p>Hello ${escapeHtml(input.customerName || 'music lover')},</p><p>Thank you for your purchase. Your order reference is <strong>${escapeHtml(input.orderNumber)}</strong>.</p><p><strong>Each purchased song can be downloaded once only.</strong> Save the file securely after the download begins. Opening this email does not use your download.</p><div style="margin-top:28px;">${itemHtml}</div><p style="margin-top:26px;color:#bcbcbc;">If a genuine technical problem prevents your download, contact Aureon support and quote your order reference.</p></div></div>`,
  });
}

export async function sendSubscriptionLifecycleEmail(input: SubscriptionEmail) {
  const planName = input.plan === 'creator' ? 'Aureon Creator' : 'Aureon Listener';
  const date = input.effectiveDate ? new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }).format(input.effectiveDate) : '';
  const amount = input.amountPaid != null
    ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: String(input.currency || 'EUR').toUpperCase() }).format(input.amountPaid / 100)
    : '';

  const messages: Record<SubscriptionEmailKind, { subject: string; heading: string; body: string }> = {
    confirmed: { subject: `Your ${planName} membership is active`, heading: 'Welcome to Aureon.', body: `Your ${planName} subscription is confirmed and your member access is now active.${date ? ` Your next renewal date is ${date}.` : ''}` },
    upgraded: { subject: 'Your Aureon membership has been upgraded', heading: 'Your Creator access is active.', body: `You have upgraded to Aureon Creator.${amount ? ` The prorated upgrade charge of ${amount} has been processed.` : ' The prorated difference has been processed by Stripe.'}${date ? ` Your normal renewal date remains ${date}.` : ''}` },
    downgraded: { subject: 'Your Aureon downgrade is scheduled', heading: 'Your plan change is confirmed.', body: `Your Aureon Creator membership will remain active for the rest of the period you have already paid for.${date ? ` On ${date}, your subscription will automatically change to Aureon Listener at €8.99 per month.` : ' At the end of the current paid period, your subscription will automatically change to Aureon Listener at €8.99 per month.'}` },
    'cancellation-scheduled': { subject: 'Your Aureon cancellation is scheduled', heading: 'Cancellation confirmed.', body: `Your ${planName} membership will remain active until the end of your paid billing period${date ? ` on ${date}` : ''}. You will not be charged again after that date.` },
    cancelled: { subject: 'Your Aureon membership has ended', heading: 'Your membership is now cancelled.', body: `Your ${planName} subscription has ended and paid member benefits are no longer active.` },
    'payment-failed': { subject: 'Action required: Aureon subscription payment failed', heading: 'We could not process your payment.', body: `Your paid member benefits have been restricted because the latest subscription payment was unsuccessful. Open Manage Billing to update your payment method.` },
    'payment-restored': { subject: 'Your Aureon membership access has been restored', heading: 'Payment received.', body: `Your subscription payment has been received and your ${planName} member benefits are active again.${date ? ` Your next renewal date is ${date}.` : ''}` },
    'renewal-paid': { subject: `${planName} payment receipt`, heading: 'Your membership payment was successful.', body: `${amount ? `We received your payment of ${amount} for ` : 'We received your payment for '}${planName}.${date ? ` Your next renewal date is ${date}.` : ''} Your member access remains active.` },
  };

  const message = messages[input.kind];
  const name = escapeHtml(input.customerName || 'music lover');
  const safeBody = escapeHtml(message.body);
  const siteUrl = escapeHtml((process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, ''));

  return sendEmail({
    to: input.to,
    subject: message.subject,
    text: `${message.heading}\n\nHello ${input.customerName || 'music lover'},\n\n${message.body}\n\nManage your membership: ${siteUrl}/account`,
    html: `<div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8;"><div style="max-width:640px;margin:0 auto;border:1px solid #5b4925;padding:34px;background:#0b0b0b;"><p style="letter-spacing:3px;color:#d8b85f;text-transform:uppercase;">Aureon Music Group</p><h1 style="font-size:32px;line-height:1.2;margin:12px 0 22px;">${escapeHtml(message.heading)}</h1><p>Hello ${name},</p><p style="font-size:17px;line-height:1.7;color:#e5e0d5;">${safeBody}</p><a href="${siteUrl}/account" style="display:inline-block;margin-top:22px;padding:14px 22px;background:#c6a34f;color:#080808;text-decoration:none;font-weight:700;">Open member dashboard</a><p style="margin-top:28px;color:#999;font-size:13px;">This is an automated account notification from Aureon Music Group.</p></div></div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
}
