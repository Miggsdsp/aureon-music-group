import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!token || token.length < 32) return downloadError('This download link is invalid.', 400);

  const downloadRef = adminFirestore.collection('downloads').doc(token);
  const snapshot = await downloadRef.get();
  if (!snapshot.exists) return downloadError('This download link is invalid or has been removed.', 404);

  const entitlement = snapshot.data() || {};
  const expiresAt = entitlement.expiresAt instanceof Timestamp
    ? entitlement.expiresAt.toDate()
    : entitlement.expiresAt?.toDate?.() || new Date(entitlement.expiresAt || 0);

  if (!entitlement.active || entitlement.status === 'used' || Number(entitlement.downloadCount || 0) >= 1) {
    return downloadError('This song has already been downloaded. Your purchase included one download only.', 410);
  }

  if (expiresAt.getTime() && expiresAt.getTime() < Date.now()) {
    await downloadRef.set({ active: false, status: 'expired', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return downloadError('This download link has expired. Please contact Aureon support and quote your order reference.', 410);
  }

  const privateFilePath = String(entitlement.privateFilePath || '');
  if (!privateFilePath.startsWith('private/full-tracks/')) {
    return downloadError('The purchased audio file is not configured correctly. Please contact Aureon support.', 500);
  }

  const file = adminStorage.bucket().file(privateFilePath);
  try {
    await file.getMetadata();
  } catch (error) {
    console.error('Purchased track is missing from private storage:', privateFilePath, error);
    return downloadError('The purchased audio file is being prepared. Please contact Aureon support with your order reference.', 503);
  }

  try {
    await adminFirestore.runTransaction(async transaction => {
      const latest = await transaction.get(downloadRef);
      const data = latest.data() || {};
      if (!latest.exists || !data.active || data.status !== 'active' || Number(data.downloadCount || 0) >= 1) {
        throw new Error('DOWNLOAD_ALREADY_USED');
      }

      transaction.update(downloadRef, {
        status: 'processing',
        processingAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DOWNLOAD_ALREADY_USED') {
      return downloadError('This song has already been downloaded. Your purchase included one download only.', 410);
    }
    throw error;
  }

  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 2 * 60 * 1000,
      responseDisposition: `attachment; filename="${safeFilename(String(entitlement.songTitle || entitlement.songId || 'aureon-song'))}.mp3"`
    });

    await downloadRef.set({
      active: false,
      status: 'used',
      downloadCount: 1,
      usedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await adminFirestore.collection('orders').doc(String(entitlement.orderId)).set({
      downloadStatus: 'downloaded',
      lastDownloadedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('Unable to release purchased download:', error);
    await downloadRef.set({
      status: 'active',
      active: true,
      processingAt: null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return downloadError('The download could not start. Your entitlement has not been used; please try again.', 503);
  }
}

function downloadError(message: string, status: number) {
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aureon Download</title></head><body style="margin:0;background:#050505;color:#f5e7b0;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:620px;padding:40px;border:1px solid #8d7134;background:#0b0b0b;text-align:center"><p style="letter-spacing:4px;text-transform:uppercase;color:#d8b85f">Aureon Music Group</p><h1>Download unavailable</h1><p style="color:#ddd;line-height:1.7">${message}</p><p><a style="color:#d8b85f" href="/contact">Contact Aureon support</a></p></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'aureon-song';
}
