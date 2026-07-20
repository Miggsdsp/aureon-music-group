import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

function monthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
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

    const key = monthKey();
    const usageRef = memberContext.memberRef.collection('downloadUsage').doc(key);
    await adminFirestore.runTransaction(async transaction => {
      const usage = await transaction.get(usageRef);
      const count = Number(usage.data()?.count || 0);
      if (count >= 5) throw new Error('QUOTA_EXCEEDED');
      transaction.set(usageRef, { month: key, count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(memberContext.memberRef, { monthlyDownloadsUsed: count + 1, monthlyDownloadMonth: key, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(memberContext.memberRef.collection('downloadHistory').doc(), { songId, songTitle: song.data()?.title || '', createdAt: FieldValue.serverTimestamp() });
    });

    const filename = `${String(song.data()?.title || 'aureon-track').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp3`;
    const [url] = await adminStorage.bucket().file(path).getSignedUrl({ action: 'read', expires: Date.now() + 5 * 60 * 1000, responseDisposition: `attachment; filename="${filename}"` });
    return NextResponse.json({ url, remaining: Math.max(0, 4 - Number(memberContext.member.monthlyDownloadsUsed || 0)) });
  } catch (error) {
    if (error instanceof Error && error.message === 'QUOTA_EXCEEDED') return NextResponse.json({ error: 'Your five monthly member downloads have been used.' }, { status: 429 });
    console.error('Member download failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
