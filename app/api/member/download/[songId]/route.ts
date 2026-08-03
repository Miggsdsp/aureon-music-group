import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';
import { recordAnalyticsEvent } from '@/lib/analytics-server';

export const runtime = 'nodejs';

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

export async function POST(request: Request, context: { params: Promise<{ songId: string }> }) {
  try {
    const memberContext = await requireMember(request);
    if (!hasActivePlan(memberContext.member)) return NextResponse.json({ error: 'An active membership is required.' }, { status: 403 });
    const { songId } = await context.params;
    const songRef = adminFirestore.collection('songs').doc(songId);
    const song = await songRef.get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });
    const path = privatePath(song.data() || {});
    if (!path.startsWith('private/full-tracks/')) return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });

    const key = billingCycleKey(memberContext.member);
    const usageRef = memberContext.memberRef.collection('downloadUsage').doc(key);
    let remaining = 0;
    let reDownload = false;

    await adminFirestore.runTransaction(async transaction => {
      const usage = await transaction.get(usageRef);
      const count = Number(usage.data()?.count || 0);
      const downloadedSongIds = Array.isArray(usage.data()?.downloadedSongIds) ? usage.data()?.downloadedSongIds.map(String) : [];
      reDownload = downloadedSongIds.includes(songId);
      if (!reDownload && count >= 5) throw new Error('QUOTA_EXCEEDED');
      const nextCount = reDownload ? count : count + 1;
      remaining = Math.max(0, 5 - nextCount);

      transaction.set(usageRef, {
        cycle: key,
        count: nextCount,
        downloadedSongIds: reDownload ? downloadedSongIds : FieldValue.arrayUnion(songId),
        resetAt: memberContext.member.currentPeriodEnd || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(memberContext.memberRef, {
        monthlyDownloadsUsed: nextCount,
        monthlyDownloadCycle: key,
        monthlyDownloadLimit: 5,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(memberContext.memberRef.collection('downloadHistory').doc(), {
        songId,
        songTitle: song.data()?.title || '',
        artist: song.data()?.artistName || song.data()?.artist || '',
        coverImageUrl: song.data()?.coverImageUrl || song.data()?.imageUrl || '',
        cycle: key,
        reDownload,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await recordAnalyticsEvent({
      eventType: 'song_download', entityType: 'song', entityId: songId,
      title: String(song.data()?.title || ''), artistId: String(song.data()?.artistId || ''),
      artistName: String(song.data()?.artistName || song.data()?.artist || ''), memberId: memberContext.uid,
      metadata: { reDownload },
    }).catch(error => console.error('Download analytics failed:', error));

    const filename = `${String(song.data()?.title || 'aureon-track').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp3`;
    const [url] = await adminStorage.bucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000, responseDisposition: `attachment; filename="${filename}"` });
    return NextResponse.json({ url, remaining, reDownload, resetAt: memberContext.member.currentPeriodEnd || null });
  } catch (error) {
    if (error instanceof Error && error.message === 'QUOTA_EXCEEDED') return NextResponse.json({ error: 'Your five downloads for this billing period have been used. Your allowance resets on your next billing date.' }, { status: 429 });
    console.error('Member download failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
