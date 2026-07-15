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

  const itemHtml = input.items.map(item => {
    const safeTitle = escapeHtml(item.title);
    const safeArtist = escapeHtml(item.artist || 'Aureon Music Group');
    const safeUrl = escapeHtml(item.downloadUrl);

    return `
      <div style="margin:0 0 22px;padding:20px;border:1px solid #c7a85a;background:#ffffff;color:#111111;">
        <div style="font-size:20px;font-weight:700;line-height:1.3;">${safeTitle}</div>
        <div style="margin-top:5px;color:#666666;">${safeArtist}</div>
        <div style="margin-top:18px;">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 22px;background:#b9973f;color:#ffffff;text-decoration:none;font-weight:700;border-radius:2px;">Download your purchased song</a>
        </div>
        <p style="margin:16px 0 6px;color:#555555;font-size:13px;line-height:1.5;">Button not working? Copy and paste this secure link into your browser:</p>
        <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.5;"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#8d7134;text-decoration:underline;">${safeUrl}</a></p>
      </div>
    `;
  }).join('');

  const textItems = input.items.map(item => (
    `${item.title}${item.artist ? ` — ${item.artist}` : ''}\nDownload link: ${item.downloadUrl}`
  )).join('\n\n');

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
      text: `Your Aureon music is ready.\n\nOrder reference: ${input.orderNumber}\n\nEach purchased song can be downloaded once only.\n\n${textItems}\n\nIf a technical problem prevents your download, contact Aureon support and quote your order reference.`,
      html: `
        <div style="background:#050505;padding:32px;font-family:Arial,sans-serif;color:#f5f1e8;">
          <div style="max-width:640px;margin:0 auto;">
            <p style="letter-spacing:3px;color:#d8b85f;text-transform:uppercase;">Aureon Music Group</p>
            <h1 style="font-size:32px;margin:10px 0 18px;">Your music is ready.</h1>
            <p>Hello ${escapeHtml(input.customerName || 'music lover')},</p>
            <p>Thank you for your purchase. Your order reference is <strong>${escapeHtml(input.orderNumber)}</strong>.</p>
            <p><strong>Each purchased song can be downloaded once only.</strong> Save the file securely after the download begins. Opening this email does not use your download.</p>
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
