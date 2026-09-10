import { createHash, randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { sendPurchaseReceiptEmail, sendPurchaseDownloadEmail, sendFulfilmentOrderNotification } from '@/lib/transactional-email';

const SITE_URL = 'https://www.aureonmusicgroup.com';
type EmailKind = 'receipt' | 'download' | 'operations';
type ReceiptInput = Parameters<typeof sendPurchaseReceiptEmail>[0];
type DownloadInput = Parameters<typeof sendPurchaseDownloadEmail>[0];
type OperationsInput = Parameters<typeof sendFulfilmentOrderNotification>[0];
type EmailInput = ReceiptInput | DownloadInput | OperationsInput;

export function purchaseDownloadEmailKey(orderId: string, items: DownloadInput['items']) {
  const generation = createHash('sha256').update(JSON.stringify(items)).digest('hex');
  return `purchase-${orderId}-download-${generation}`;
}

// Persist each payload before sending. Retries must use the same payload and key,
// including when Resend accepted the request but the response/write was lost.
async function sendOnce(orderId: string, kind: EmailKind, input: EmailInput) {
  const orderRef = adminFirestore.collection('orders').doc(orderId);
  const jobRef = orderRef.collection('emailFulfilment').doc(kind);
  const owner = randomUUID();
  const statusField = `${kind}EmailStatus`;
  const claimed = await adminFirestore.runTransaction(async transaction => {
    const [orderSnapshot, jobSnapshot] = await Promise.all([transaction.get(orderRef), transaction.get(jobRef)]);
    const order = orderSnapshot.data() || {};
    const job = jobSnapshot.data() || {};
    if (order.status !== 'paid') throw new Error('ORDER_NOT_PAID');
    if (order[statusField] === 'sent' || job.status === 'sent') return null;
    // Older orders used emailStatus for the receipt, but regeneration overwrote it.
    // Only trust that legacy marker when no regeneration has occurred.
    if (kind === 'receipt' && !order.receiptEmailStatus && !order.downloadRegeneratedAt && order.emailStatus === 'sent') {
      transaction.set(orderRef, { receiptEmailStatus: 'sent' }, { merge: true });
      return null;
    }
    if (Number(job.leaseUntil || 0) > Date.now()) throw new Error('EMAIL_SEND_IN_PROGRESS');
    const payload = job.payload || JSON.parse(JSON.stringify(input));
    transaction.set(jobRef, { payload, status: 'sending', owner, leaseUntil: Date.now() + 60000, attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(orderRef, { [statusField]: 'sending', purchaseEmailsPending: true }, { merge: true });
    return payload as EmailInput;
  });
  if (!claimed) return;

  try {
    const inputWithKey = { ...claimed, idempotencyKey: kind === 'download' ? purchaseDownloadEmailKey(orderId, (claimed as DownloadInput).items) : `purchase-${orderId}-${kind}-v1` };
    const result = kind === 'receipt' ? await sendPurchaseReceiptEmail(inputWithKey as ReceiptInput)
      : kind === 'download' ? await sendPurchaseDownloadEmail(inputWithKey as DownloadInput)
      : await sendFulfilmentOrderNotification(inputWithKey as OperationsInput);
    if (!result.sent) throw new Error('EMAIL_NOT_CONFIGURED');
    await adminFirestore.runTransaction(async transaction => {
      const job = await transaction.get(jobRef);
      if (job.data()?.owner !== owner) throw new Error('EMAIL_LEASE_LOST');
      transaction.set(jobRef, { status: 'sent', leaseUntil: 0, sentAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(orderRef, {
        [statusField]: 'sent', [`${kind}EmailSentAt`]: FieldValue.serverTimestamp(),
        [`${kind}EmailError`]: FieldValue.delete(),
        ...(kind === 'receipt' ? { emailStatus: 'sent', emailSentAt: FieldValue.serverTimestamp() } : {}),
      }, { merge: true });
    });
  } catch (error) {
    await adminFirestore.runTransaction(async transaction => {
      const job = await transaction.get(jobRef);
      if (job.data()?.owner !== owner || job.data()?.status === 'sent') return;
      transaction.set(jobRef, { status: 'failed', leaseUntil: 0 }, { merge: true });
      // Do not store provider response bodies, which may contain sensitive content.
      transaction.set(orderRef, { [statusField]: 'failed', [`${kind}EmailError`]: 'Email send failed; retry pending.', purchaseEmailsPending: true }, { merge: true });
    });
    throw error;
  }
}

export async function sendPaidOrderEmails(orderId: string) {
  const orderRef = adminFirestore.collection('orders').doc(orderId);
  const snapshot = await orderRef.get();
  const order = snapshot.data() || {};
  if (order.status !== 'paid') throw new Error('ORDER_NOT_PAID');
  if (!order.customerEmail) throw new Error('PAID_ORDER_EMAIL_MISSING');
  const songs: Array<Record<string, any>> = Array.isArray(order.songs) ? order.songs : [];
  const products: Array<Record<string, any>> = Array.isArray(order.products) ? order.products : [];
  const common = { to: String(order.customerEmail), customerName: String(order.customerName || ''), orderNumber: String(order.orderNumber || orderId) };
  const receipt = {
    ...common, amountTotal: Number(order.amountTotal || 0), currency: String(order.currency || 'eur'), deliveryAddress: order.deliveryAddress || null,
    items: [
      ...songs.map(song => ({ name: `${song.title} — ${song.artist}`, quantity: Number(song.quantity || 1), unitAmount: Number(song.unitAmount || 0) })),
      ...products.map(product => ({ name: String(product.name), quantity: Number(product.quantity || 1), unitAmount: Number(product.unitAmount || 0), size: String(product.size || ''), colour: String(product.colour || '') })),
    ],
  };
  const failures: unknown[] = [];
  try { await sendOnce(orderId, 'receipt', receipt); } catch (error) { failures.push(error); }
  // A receipt failure must not prevent delivery of the separately tracked music email.
  if (songs.length && order.downloadEmailStatus !== 'sent') {
    try {
      const downloads = await adminFirestore.collection('downloads').where('orderId', '==', orderId).get();
      const items = songs.map(song => {
        const document = downloads.docs.find(doc => doc.data().songId === song.id && doc.data().active !== false && doc.data().status !== 'superseded');
        if (!document) throw new Error('PURCHASE_DOWNLOAD_ENTITLEMENT_MISSING');
        return { title: String(song.title), artist: String(song.artist || ''), downloadUrl: `${SITE_URL}/api/download/${document.id}` };
      });
      await adminFirestore.runTransaction(async transaction => {
        const current = await Promise.all(downloads.docs.map(doc => transaction.get(doc.ref)));
        for (const doc of current) {
          const data = doc.data() || {};
          if (data.active !== false && data.status === 'active' && Number(data.downloadCount || 0) === 0) {
            transaction.set(doc.ref, { expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) }, { merge: true });
          }
        }
      });
      await sendOnce(orderId, 'download', { ...common, items });
    } catch (error) { failures.push(error); }
  }
  if (products.length) {
    try {
      await sendOnce(orderId, 'operations', {
        ...receipt, customerEmail: common.to, customerPhone: String(order.customerPhone || ''),
        items: receipt.items.slice(songs.length),
        // Keep the rendered notification stable across retries.
        paidAt: order.paidAt?.toDate?.().toISOString() || new Date(0).toISOString(),
      });
    } catch (error) { failures.push(error); }
  }
  if (failures.length) {
    await orderRef.set({ purchaseEmailsPending: true, purchaseEmailRetryAt: Date.now() + 15 * 60 * 1000 }, { merge: true });
    throw new Error('PURCHASE_EMAIL_RETRY_REQUIRED');
  }
  await orderRef.set({ purchaseEmailsPending: false, purchaseEmailRetryAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
