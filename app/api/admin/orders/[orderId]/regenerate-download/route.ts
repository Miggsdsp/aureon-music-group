import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';
import { sendPurchaseDownloadEmail } from '@/lib/transactional-email';

export const runtime = 'nodejs';

type Context = { params: Promise<{ orderId: string }> };

type OrderSong = {
  id?: string;
  title?: string;
  artist?: string;
  privateFilePath?: string;
};

function getPrivateFilePath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

export async function POST(request: Request, context: Context) {
  try {
    const admin = await requireAdminApi(request);
    const { orderId } = await context.params;
    const orderRef = adminFirestore.collection('orders').doc(orderId);
    const orderSnapshot = await orderRef.get();
    if (!orderSnapshot.exists) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

    const order = orderSnapshot.data() || {};
    if (String(order.status || '') !== 'paid') {
      return NextResponse.json({ error: 'Only paid orders can receive regenerated downloads.' }, { status: 409 });
    }

    const customerEmail = String(order.customerEmail || '').trim();
    if (!customerEmail) return NextResponse.json({ error: 'This order has no customer email address.' }, { status: 409 });

    const sourceSongs: OrderSong[] = Array.isArray(order.songs) ? order.songs : [];
    if (!sourceSongs.length) return NextResponse.json({ error: 'This order contains no downloadable songs.' }, { status: 409 });

    const songs = await Promise.all(sourceSongs.map(async item => {
      const songId = String(item.id || '');
      if (!songId) throw new Error('ORDER_SONG_ID_MISSING');
      const songSnapshot = await adminFirestore.collection('songs').doc(songId).get();
      const data = songSnapshot.data() || {};
      const privateFilePath = getPrivateFilePath(data) || String(item.privateFilePath || '');
      if (!privateFilePath.startsWith('private/full-tracks/')) throw new Error('PRIVATE_FILE_MISSING');
      return {
        id: songId,
        title: String(data.title || data.name || item.title || songId),
        artist: String(data.artistName || data.artist || data.details?.artistName || item.artist || 'Aureon Music Group'),
        privateFilePath,
        token: randomBytes(32).toString('hex')
      };
    }));

    const oldDownloads = await adminFirestore.collection('downloads').where('orderId', '==', orderId).get();
    const batch = adminFirestore.batch();
    oldDownloads.docs.forEach(document => batch.set(document.ref, {
      active: false,
      status: document.data().status === 'used' ? 'used' : 'superseded',
      supersededAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }));

    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    songs.forEach(song => {
      const ref = adminFirestore.collection('downloads').doc(song.token);
      batch.set(ref, {
        token: song.token,
        orderId,
        orderNumber: order.orderNumber || orderId,
        songId: song.id,
        songTitle: song.title,
        artist: song.artist,
        privateFilePath: song.privateFilePath,
        customerEmail,
        active: true,
        status: 'active',
        maxDownloads: 1,
        downloadCount: 0,
        expiresAt,
        regeneratedBy: admin.uid,
        regeneratedByEmail: admin.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    batch.set(orderRef, {
      downloadStatus: 'available',
      downloadRegeneratedAt: FieldValue.serverTimestamp(),
      downloadRegeneratedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
    const result = await sendPurchaseDownloadEmail({
      to: customerEmail,
      customerName: String(order.customerName || ''),
      orderNumber: String(order.orderNumber || orderId),
      items: songs.map(song => ({
        title: song.title,
        artist: song.artist,
        downloadUrl: `${siteUrl}/api/download/${song.token}`
      }))
    });

    await orderRef.set({
      emailStatus: result.sent ? 'sent' : 'not-configured',
      emailSentAt: result.sent ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({ ok: true, downloads: songs.length, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    console.error('Download regeneration failed:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
    if (code === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    if (code === 'PRIVATE_FILE_MISSING') return NextResponse.json({ error: 'A purchased song is not connected to a private full-track file.' }, { status: 409 });
    return NextResponse.json({ error: 'The download email could not be regenerated.' }, { status: 500 });
  }
}
