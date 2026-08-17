import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ token: string }>;
};

type SongData = Record<string, any>;

function getPrivateFilePath(data: SongData) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return String(
    data.privateFilePath ||
    details.privateFilePath ||
    data.fullTrackPath ||
    details.fullTrackPath ||
    ''
  ).trim();
}

function normalise(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function resolveSongRecord(reference: string, title: string) {
  const songs = adminFirestore.collection('songs');

  if (reference) {
    const direct = await songs.doc(reference).get();
    if (direct.exists) return direct;

    const bySlug = await songs.where('slug', '==', reference).limit(1).get();
    if (!bySlug.empty) return bySlug.docs[0];
  }

  if (title) {
    const byTitle = await songs.where('title', '==', title).limit(1).get();
    if (!byTitle.empty) return byTitle.docs[0];
  }

  return null;
}

async function fileExists(path: string) {
  if (!path.startsWith('private/full-tracks/')) return null;
  const file = adminStorage.bucket().file(path);
  try {
    await file.getMetadata();
    return file;
  } catch {
    return null;
  }
}

async function discoverUploadedTrack(songData: SongData, fallbackTitle: string) {
  const bucket = adminStorage.bucket();
  const details = songData.details && typeof songData.details === 'object' ? songData.details : {};
  const songSlug = String(songData.slug || details.slug || songData.title || songData.name || fallbackTitle);
  const artistSlug = String(songData.artistSlug || details.artistSlug || '');
  const target = normalise(songSlug || fallbackTitle);

  const prefixes = [
    artistSlug ? `private/full-tracks/${artistSlug}/` : '',
    'private/full-tracks/'
  ].filter(Boolean);

  for (const prefix of prefixes) {
    try {
      const [files] = await bucket.getFiles({ prefix, maxResults: 1000 });
      const audioFiles = files.filter(file => /\.(mp3|wav|m4a|aac|flac)$/i.test(file.name));

      const matching = audioFiles
        .map(file => {
          const base = normalise(file.name.split('/').pop());
          let score = 0;
          if (base === target) score += 100;
          if (target && base.includes(target)) score += 70;
          if (target && target.includes(base)) score += 40;
          if (artistSlug && file.name.includes(`/${artistSlug}/`)) score += 20;
          return { file, score };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score || b.file.name.localeCompare(a.file.name));

      if (matching[0]) return { file: matching[0].file, path: matching[0].file.name };
    } catch (error) {
      console.error('Unable to scan private track storage:', { prefix, error });
    }
  }

  return null;
}

async function resolveExistingPrivateFile(entitlement: Record<string, any>) {
  const candidates: string[] = [];
  const entitlementPath = String(entitlement.privateFilePath || '').trim();
  if (entitlementPath) candidates.push(entitlementPath);

  const songReference = String(entitlement.songId || '');
  const songTitle = String(entitlement.songTitle || '');
  const songSnapshot = await resolveSongRecord(songReference, songTitle);
  const songData = songSnapshot?.data() || {};

  if (songSnapshot) {
    const currentPath = getPrivateFilePath(songData);
    if (currentPath && !candidates.includes(currentPath)) candidates.push(currentPath);
  }

  for (const path of candidates) {
    const file = await fileExists(path);
    if (file) return { file, path, songId: songSnapshot?.id || songReference };
  }

  const discovered = await discoverUploadedTrack(songData, songTitle || songReference);
  if (discovered) return { ...discovered, songId: songSnapshot?.id || songReference };

  return null;
}

export async function GET(request: Request, context: RouteContext) {
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

  const resolved = await resolveExistingPrivateFile(entitlement);
  if (!resolved) {
    console.error('Purchased track is missing from private storage:', {
      bucket: adminStorage.bucket().name,
      songId: entitlement.songId,
      songTitle: entitlement.songTitle,
      privateFilePath: entitlement.privateFilePath
    });
    return downloadError('The purchased audio file is not connected to this order yet. Please contact Aureon support with your order reference.', 503);
  }

  const { file, path: privateFilePath, songId } = resolved;
  if (privateFilePath !== entitlement.privateFilePath || songId !== entitlement.songId) {
    await downloadRef.set({
      privateFilePath,
      songId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }

  const shouldDownload = new URL(request.url).searchParams.get('download') === '1';
  if (!shouldDownload) {
    return downloadPage(token, String(entitlement.songTitle || songId || 'Your purchased song'));
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
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType || 'audio/mpeg');
    const extension = contentType.includes('wav') ? 'wav' : privateFilePath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3';
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000,
      responseDisposition: `attachment; filename="${safeFilename(String(entitlement.songTitle || songId || 'aureon-song'))}.${extension}"`,
      responseType: contentType
    });

    await downloadRef.set({
      active: false,
      status: 'used',
      downloadCount: 1,
      usedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    if (entitlement.orderId) {
      await adminFirestore.collection('orders').doc(String(entitlement.orderId)).set({
        downloadStatus: 'downloaded',
        lastDownloadedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

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

function downloadPage(token: string, songTitle: string) {
  const safeTitle = escapeHtml(songTitle);
  const downloadHref = `/api/download/${encodeURIComponent(token)}?download=1`;

  return new NextResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Download ${safeTitle} | Aureon Music Group</title>
</head>
<body style="margin:0;background:#050505;color:#f7f2e7;font-family:Arial,Helvetica,sans-serif;min-height:100vh;display:flex;flex-direction:column">
  <main style="flex:1;display:grid;place-items:center;padding:32px 18px;background:radial-gradient(circle at top,#17130b 0,#080808 42%,#050505 72%)">
    <section style="width:min(100%,680px);box-sizing:border-box;padding:44px 34px;border:1px solid rgba(216,184,95,.45);border-radius:18px;background:rgba(10,10,10,.96);box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center">
      <a href="/" aria-label="Aureon Music Group home" style="display:inline-block;margin-bottom:28px">
        <img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group" style="display:block;width:min(100%,300px);height:auto;margin:0 auto">
      </a>
      <p style="margin:0 0 14px;color:#d8b85f;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase">Purchase confirmed</p>
      <h1 style="margin:0 0 14px;font-size:clamp(28px,6vw,42px);line-height:1.08;color:#fff">Your song is ready</h1>
      <p style="margin:0 auto 10px;color:#f0dfaa;font-size:20px;line-height:1.45">${safeTitle}</p>
      <p style="margin:0 auto 30px;max-width:520px;color:#bcbcbc;font-size:15px;line-height:1.7">Press the button below to securely download your purchased Aureon track. Your purchase includes one download.</p>
      <a href="${downloadHref}" style="display:inline-flex;align-items:center;justify-content:center;min-width:220px;padding:16px 28px;border-radius:999px;background:linear-gradient(135deg,#f0d98b,#b98a2f);color:#080808;font-size:16px;font-weight:800;text-decoration:none;box-shadow:0 10px 32px rgba(216,184,95,.18)">Download Song</a>
      <p style="margin:28px 0 0;color:#8f8f8f;font-size:12px;line-height:1.7">By downloading your purchase, you agree to Aureon Music Group's <a href="/terms" style="color:#d8b85f;text-decoration:none">Terms &amp; Conditions</a> and <a href="/digital-download-policy" style="color:#d8b85f;text-decoration:none">Digital Download Policy</a>.</p>
      <p style="margin:16px 0 0;font-size:12px"><a href="/contact" style="color:#b9b9b9;text-decoration:none">Need help? Contact Aureon support</a></p>
    </section>
  </main>
  <footer style="padding:18px;text-align:center;border-top:1px solid #181818;background:#050505;color:#777;font-size:11px;letter-spacing:.5px">© ${new Date().getFullYear()} Aureon Music Group</footer>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function downloadError(message: string, status: number) {
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aureon Download</title></head><body style="margin:0;background:#050505;color:#f5e7b0;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:620px;padding:40px;border:1px solid #8d7134;background:#0b0b0b;text-align:center"><img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group" style="display:block;width:min(100%,280px);height:auto;margin:0 auto 28px"><h1>Download unavailable</h1><p style="color:#ddd;line-height:1.7">${escapeHtml(message)}</p><p><a style="color:#d8b85f" href="/contact">Contact Aureon support</a></p><p style="font-size:12px"><a style="color:#aaa" href="/terms">Terms &amp; Conditions</a></p></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'aureon-song';
}
