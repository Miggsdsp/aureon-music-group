import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { cleanText, clientIp, enforceRateLimit, validEmail, writeAuditLog } from '@/lib/server-security';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  try {
    const allowed = await enforceRateLimit('contact', ip, 5, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 20_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });

    const body = await request.json();
    if (body.website) return NextResponse.json({ ok: true });

    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 180).toLowerCase();
    const subject = cleanText(body.subject, 180);
    const department = cleanText(body.department, 80);
    const message = cleanText(body.message, 5000);

    if (!name || !validEmail(email) || !subject || message.length < 10) {
      return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
    }

    const ref = await adminFirestore.collection('enquiries').add({
      name, email, subject, department, message,
      status: 'new', source: 'website', ip,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.CONTACT_NOTIFICATION_EMAIL || 'info@aureonmusicgroup.com';
    const from = process.env.TRANSACTIONAL_EMAIL_FROM || 'Aureon Music Group <downloads@aureonmusicgroup.com>';
    if (apiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [to], reply_to: email,
          subject: `Aureon enquiry: ${subject}`,
          text: `Name: ${name}\nEmail: ${email}\nDepartment: ${department}\nReference: ${ref.id}\n\n${message}`,
        }),
      });
      if (!response.ok) console.error('Contact notification email failed:', await response.text());
    }

    await writeAuditLog('contact.created', { enquiryId: ref.id, ip, department });
    return NextResponse.json({ ok: true, reference: ref.id });
  } catch (error) {
    console.error('Contact submission failed:', error);
    return NextResponse.json({ error: 'Your message could not be sent. Please try again.' }, { status: 500 });
  }
}
