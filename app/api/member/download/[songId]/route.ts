import { randomBytes } from 'crypto';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';
import { recordAnalyticsEvent } from '@/lib/analytics-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ songId: string }> };

function billingCycleKey(member: Record<string, any>) {
  const value = member.currentPeriodEnd;
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (date && !Number.isNaN(date.getTime())) return `cycle-${date.toISOString().slice(0, 10)}`;
  const now = new Date();
  return `cycle-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function privatePath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

function extensionFor(path: string, contentType: string) {
  const match = path.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  if (match?.[1]) return match[1];
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('flac')) return 'flac';
  if (contentType.includes('aac')) return 'aac';
  if (contentType.includes('mp4') || contentType.includes('m4a')) return 'm4a';
  return 'mp3';
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '-') || 'aureon-track';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tokenExpiry(data: Record<string, any>) {
  const value = data.expiresAt;
  if (value instanceof Timestamp) return value.toDate();
  return value?.toDate?.() || new Date(value || 0);
}

function memberSelectionIds(member: Record<string, any>) {
  return Array.isArray(member.monthlyDownloadedSongIds) ? member.monthlyDownloadedSongIds.map(String) : [];
}

function effectiveUsage(member: Record<string, any>, usageData: Record<string, any> = {}, historySongIds: string[] = [], historyCount = 0) {
  const ids = new Set<string>([
    ...memberSelectionIds(member),
    ...(Array.isArray(usageData.downloadedSongIds) ? usageData.downloadedSongIds.map(String) : []),
    ...historySongIds,
  ]);
  const count = Math.max(
    Number(member.monthlyDownloadsUsed || 0),
    Number(usageData.count || 0),
    Number(historyCount || 0),
    ids.size,
  );
  return { ids, count };
}

async function currentBillingHistory(memberRef: FirebaseFirestore.DocumentReference, member: Record<string, any>) {
  const paidAt = member.lastInvoicePaidAt?.toDate?.() || (member.lastInvoicePaidAt ? new Date(member.lastInvoicePaidAt) : null);
  if (!paidAt || Number.isNaN(paidAt.getTime())) return { songIds: [] as string[], count: 0 };
  const snapshot = await memberRef.collection('downloadHistory').where('createdAt', '>=', Timestamp.fromDate(paidAt)).get();
  return {
    songIds: Array.from(new Set(snapshot.docs.map(doc => String(doc.data()?.songId || '')).filter(Boolean))),
    count: snapshot.size,
  };
}

function downloadPage(songId: string, token: string, songTitle: string, remaining: number) {
  const safeTitle = escapeHtml(songTitle);
  const href = `/api/member/download/${encodeURIComponent(songId)}?token=${encodeURIComponent(token)}&download=1`;
  const allowanceCopy = `This download will leave ${Math.max(0, remaining - 1)} of your 5 Creator downloads remaining for the current billing period.`;

  return new NextResponse(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Creator Download | Aureon Music Group</title>
</head>
<body style="margin:0;background:#050505;color:#f7f2e7;font-family:Arial,Helvetica,sans-serif;min-height:100vh;display:flex;flex-direction:column">
  <main style="flex:1;display:grid;place-items:center;padding:32px 18px;background:radial-gradient(circle at top,#17130b 0,#080808 42%,#050505 72%)">
    <section style="width:min(100%,680px);box-sizing:border-box;padding:44px 34px;border:1px solid rgba(216,184,95,.45);border-radius:18px;background:rgba(10,10,10,.96);box-shadow:0 24px 80px rgba(0,0,0,.55);text-align:center">
      <a href="/" aria-label="Aureon Music Group home" style="display:inline-block;margin-bottom:28px">
        <img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group" style="display:block;width:min(100%,300px);height:auto;margin:0 auto">
      </a>
      <p style="margin:0 0 14px;color:#d8b85f;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase">Creator membership</p>
      <h1 style="margin:0 0 14px;font-size:clamp(28px,6vw,42px);line-height:1.08;color:#fff">Your licensed song is ready</h1>
      <p style="margin:0 auto 10px;color:#f0dfaa;font-size:20px;line-height:1.45">${safeTitle}</p>
      <p style="margin:0 auto 18px;max-width:520px;color:#bcbcbc;font-size:15px;line-height:1.7">Download the original Aureon master supplied with your Creator membership rights.</p>
      <p style="margin:0 auto 30px;max-width:520px;color:#969696;font-size:13px;line-height:1.7">${escapeHtml(allowanceCopy)}</p>
      <a href="${href}" download style="display:inline-flex;align-items:center;justify-content:center;min-width:240px;padding:17px 30px;border-radius:999px;background:linear-gradient(135deg,#f0d98b,#b98a2f);color:#080808;font-size:16px;font-weight:800;text-decoration:none;box-shadow:0 10px 32px rgba(216,184,95,.18)">Download Song</a>
      <p style="margin:28px 0 0;color:#8f8f8f;font-size:12px;line-height:1.7">By downloading this track, you agree to Aureon Music Group's <a href="/terms" style="color:#d8b85f;text-decoration:none">Terms &amp; Conditions</a> and <a href="/digital-download-policy" style="color:#d8b85f;text-decoration:none">Digital Download Policy</a>.</p>
      <p style="margin:16px 0 0;font-size:12px"><a href="/contact" style="color:#b9b9b9;text-decoration:none">Need help? Contact Aureon support</a></p>
    </section>
  </main>
  <footer style="padding:18px;text-align:center;border-top:1px solid #181818;background:#050505;color:#777;font-size:11px;letter-spacing:.5px">© ${new Date().getFullYear()} Aureon Music Group</footer>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0' }
  });
}

function downloadError(message: string, status: number) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Aureon Creator Download</title></head><body style="margin:0;background:#050505;color:#f5e7b0;font-family:Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="width:min(calc(100% - 36px),620px);box-sizing:border-box;padding:40px;border:1px solid #8d7134;background:#0b0b0b;text-align:center"><img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group" style="display:block;width:min(100%,280px);height:auto;margin:0 auto 28px"><h1>Download unavailable</h1><p style="color:#ddd;line-height:1.7">${escapeHtml(message)}</p><p><a style="color:#d8b85f" href="/library">Return to your library</a></p><p style="font-size:12px"><a style="color:#aaa" href="/terms">Terms &amp; Conditions</a></p></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0' }
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const memberContext = await requireMember(request);
    if (!hasActivePlan(memberContext.member, 'creator')) {
      return NextResponse.json({ error: 'An active Aureon Creator membership with Creator licensing rights is required. Listener memberships do not include subscription downloads.' }, { status: 403 });
    }

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });

    const data = song.data() || {};
    const path = privatePath(data);
    if (!path.startsWith('private/full-tracks/')) return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });

    const file = adminStorage.bucket().file(path);
    try { await file.getMetadata(); } catch { return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 }); }

    const key = billingCycleKey(memberContext.member);
    const [usage, history] = await Promise.all([
      memberContext.memberRef.collection('downloadUsage').doc(key).get(),
      currentBillingHistory(memberContext.memberRef, memberContext.member),
    ]);
    const effective = effectiveUsage(memberContext.member, usage.data() || {}, history.songIds, history.count);
    if (effective.count >= 5) {
      return NextResponse.json({ error: 'Your five Creator downloads for this billing period have been used. Your allowance resets on your next billing date.' }, { status: 429 });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = Timestamp.fromMillis(Date.now() + 15 * 60 * 1000);
    await adminFirestore.collection('creatorDownloadTokens').doc(token).set({
      active: true,
      status: 'active',
      uid: memberContext.uid,
      songId,
      songTitle: String(data.title || 'Aureon track'),
      privateFilePath: path,
      cycle: key,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    return NextResponse.json({
      url: `/api/member/download/${songId}?token=${token}`,
      remaining: Math.max(0, 5 - effective.count),
      resetAt: memberContext.member.currentPeriodEnd || null,
    });
  } catch (error) {
    console.error('Member download preparation failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { songId } = await context.params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    if (token.length < 32) return downloadError('This Creator download link is invalid.', 400);

    const tokenRef = adminFirestore.collection('creatorDownloadTokens').doc(token);
    const tokenSnapshot = await tokenRef.get();
    if (!tokenSnapshot.exists) return downloadError('This Creator download link is invalid or has been removed.', 404);

    const tokenData = tokenSnapshot.data() || {};
    if (String(tokenData.songId || '') !== songId) return downloadError('This Creator download link is invalid.', 400);
    if (!tokenData.active || tokenData.status === 'used') return downloadError('This download has already been completed. Return to your library to request another link.', 410);
    if (tokenExpiry(tokenData).getTime() < Date.now()) {
      await tokenRef.set({ active: false, status: 'expired', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return downloadError('This secure download page has expired. Return to your library and select Download again.', 410);
    }

    const memberRef = adminFirestore.collection('members').doc(String(tokenData.uid || ''));
    const memberSnapshot = await memberRef.get();
    if (!memberSnapshot.exists || !hasActivePlan(memberSnapshot.data() || {}, 'creator')) {
      return downloadError('An active Aureon Creator membership is required for this download.', 403);
    }

    const memberData = memberSnapshot.data() || {};
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return downloadError('This song is no longer available.', 404);
    const songData = song.data() || {};
    const path = privatePath(songData);
    if (!path.startsWith('private/full-tracks/')) return downloadError('The full track is unavailable.', 404);

    const key = billingCycleKey(memberData);
    const [usageSnapshot, history] = await Promise.all([
      memberRef.collection('downloadUsage').doc(key).get(),
      currentBillingHistory(memberRef, memberData),
    ]);
    const initialEffective = effectiveUsage(memberData, usageSnapshot.data() || {}, history.songIds, history.count);
    if (initialEffective.count >= 5) return downloadError('Your five Creator downloads for this billing period have been used.', 429);

    if (url.searchParams.get('download') !== '1') {
      return downloadPage(songId, token, String(songData.title || tokenData.songTitle || 'Aureon track'), Math.max(0, 5 - initialEffective.count));
    }

    let nextCount = initialEffective.count;
    await adminFirestore.runTransaction(async transaction => {
      const latestToken = await transaction.get(tokenRef);
      const latestMember = await transaction.get(memberRef);
      if (!latestToken.exists || !latestToken.data()?.active || latestToken.data()?.status !== 'active') throw new Error('TOKEN_USED');
      if (tokenExpiry(latestToken.data() || {}).getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');
      if (!latestMember.exists || !hasActivePlan(latestMember.data() || {}, 'creator')) throw new Error('CREATOR_REQUIRED');

      const latestMemberData = latestMember.data() || {};
      const liveKey = billingCycleKey(latestMemberData);
      const usageRef = memberRef.collection('downloadUsage').doc(liveKey);
      const usage = await transaction.get(usageRef);
      const effective = effectiveUsage(latestMemberData, usage.data() || {}, history.songIds, history.count);
      if (effective.count >= 5) throw new Error('QUOTA_EXCEEDED');

      const selectedIds = new Set(effective.ids);
      selectedIds.add(songId);
      nextCount = effective.count + 1;
      const canonicalIds = Array.from(selectedIds);

      transaction.set(usageRef, {
        cycle: liveKey,
        count: nextCount,
        downloadedSongIds: canonicalIds,
        resetAt: latestMemberData.currentPeriodEnd || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(memberRef, {
        monthlyDownloadsUsed: nextCount,
        monthlyDownloadedSongIds: canonicalIds,
        monthlyDownloadCycle: liveKey,
        monthlyDownloadLimit: 5,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(memberRef.collection('downloadHistory').doc(), {
        songId,
        songTitle: songData.title || '',
        artist: songData.artistName || songData.artist || '',
        coverImageUrl: songData.coverImageUrl || songData.imageUrl || '',
        cycle: liveKey,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(tokenRef, {
        active: false,
        status: 'used',
        usedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await recordAnalyticsEvent({
      eventType: 'song_download',
      entityType: 'song',
      entityId: songId,
      title: String(songData.title || ''),
      artistId: String(songData.artistId || ''),
      artistName: String(songData.artistName || songData.artist || ''),
      memberId: String(tokenData.uid || ''),
      metadata: { plan: 'creator' },
    }).catch(error => console.error('Download analytics failed:', error));

    const masterFile = adminStorage.bucket().file(path);
    const [metadata] = await masterFile.getMetadata();
    const originalContentType = String(metadata.contentType || 'audio/wav');
    const extension = extensionFor(path, originalContentType);
    const filename = `${safeFilename(String(songData.title || 'aureon-track'))}.${extension}`;
    const body = Readable.toWeb(masterFile.createReadStream()) as ReadableStream;
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Aureon-Content-Type': originalContentType,
    });
    if (metadata.size) headers.set('Content-Length', String(metadata.size));

    return new Response(body, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'TOKEN_USED') return downloadError('This download link has already been used. Return to your library to request another link.', 410);
      if (error.message === 'TOKEN_EXPIRED') return downloadError('This secure download page has expired. Return to your library and select Download again.', 410);
      if (error.message === 'CREATOR_REQUIRED') return downloadError('An active Aureon Creator membership is required for this download.', 403);
      if (error.message === 'QUOTA_EXCEEDED') return downloadError('Your five Creator downloads for this billing period have been used.', 429);
    }
    console.error('Creator download failed:', error);
    return downloadError('The download could not start. Return to your library and try again.', 500);
  }
}
