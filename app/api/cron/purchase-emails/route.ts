import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { sendPaidOrderEmails } from '@/lib/purchase-email-fulfilment';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Single-field query uses Firestore's automatic index. Old orders are not mass-emailed.
  const pending = await adminFirestore.collection('orders')
    .where('purchaseEmailRetryAt', '<=', Date.now()).orderBy('purchaseEmailRetryAt').limit(50).get();
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  for (const document of pending.docs) {
    if (Date.now() - started > 210000) break;
    try {
      await sendPaidOrderEmails(document.id);
      sent += 1;
    } catch {
      failed += 1;
      // Rotate failed records so a bad address cannot starve later orders.
      await document.ref.set({ purchaseEmailRetryAt: Date.now() + 15 * 60 * 1000 }, { merge: true });
    }
  }
  return NextResponse.json({ ok: failed === 0, processed: sent + failed, sent, failed });
}
