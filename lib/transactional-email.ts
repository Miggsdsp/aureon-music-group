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

export async function sendPurchaseDownloadEmail(input: PurchaseEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <downloads@aureonmusicgroup.com>';

  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured. Download email was not sent.');
    return { sent: false, reason: 'not-configured' } as const;
  }

  const itemHtml = input.items.map(item => `
    <div style="margin:0 0 22px;padding:18px;border:1px solid #c7a85a;background:#0b0b0b;color:#fff;">
      <div style="font-size:18px;font-weight:700;">${escapeHtml(item.title)}</div>
      <div style="margin-top:4px;color:#c8c8c8;">${escapeHtml(item.artist || 'Aureon Music Group')}</div>
      <a href="${item.downloadUrl}" style="display:inline-block;margin-top:16px;padding:12px 18px;background:#d8b85f;color:#050505;text-decoration:none;font-weight:700;">Download song once</a>
    </div>
  `).join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Your Aureon download is ready — ${input.orderNumber}`,
      html: `
        <div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8;">
          <div style="max-width:640px;margin:0 auto;">
            <p style="letter-spacing:3px;color:#d8b85f;text-transform:uppercase;">Aureon Music Group</p>
            <h1 style="font-size:32px;margin:10px 0 18px;">Your music is ready.</h1>
            <p>Hello ${escapeHtml(input.customerName || 'music lover')},</p>
            <p>Thank you for your purchase. Your order reference is <strong>${escapeHtml(input.orderNumber)}</strong>.</p>
            <p><strong>Each purchased song can be downloaded once only.</strong> Please save the file securely after the download begins. Opening this email does not use your download; the entitlement is used when Aureon releases the file.</p>
            <div style="margin-top:28px;">${itemHtml}</div>
            <p style="margin-top:26px;color:#bcbcbc;">If a genuine technical problem prevents your download, contact Aureon support and quote your order reference.</p>
          </div>
        </div>
      `
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${details}`);
  }

  return { sent: true } as const;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character] || character));
}
