import { NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';
import { createPlaybackTicket, PLAYBACK_TICKET_TTL_SECONDS } from '@/lib/playback-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function playbackPath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const stream = String(data.streamFilePath || details.streamFilePath || '').trim();
  if (stream.startsWith('private/streams/')) return stream;

  // Backward compatibility for songs uploaded before Aureon's compressed-stream pipeline.
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

export async function GET(request: Request, context: { params: Promise<{ songId: string }> }) {
  try {
    const { member, uid } = await requireMember(request);
    if (!hasActivePlan(member)) return NextResponse.json({ error: 'An active Aureon membership is required.' }, { status: 403 });

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });

    const path = playbackPath(song.data() || {});
    if (!path.startsWith('private/streams/') && !path.startsWith('private/full-tracks/')) {
      return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });
    }

    // Keep objects private. Authorized subscribers receive a temporary signed
    // Cloud Storage URL, so audio bytes bypass Vercel. Retain the original
    // protected proxy as a fallback when URL signing is unavailable.
    let url: string;
    let delivery: 'firebase-storage' | 'vercel-fallback' = 'firebase-storage';
    try {
      const [signedUrl] = await adminStorage.bucket().file(path).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + PLAYBACK_TICKET_TTL_SECONDS * 1000,
        responseDisposition: 'inline',
      });
      url = signedUrl;
    } catch (signingError) {
      console.error('Direct audio URL signing unavailable; using protected fallback:', signingError);
      const ticket = createPlaybackTicket(uid, songId);
      url = `/api/member/audio/${encodeURIComponent(songId)}?ticket=${encodeURIComponent(ticket)}`;
      delivery = 'vercel-fallback';
    }
    return NextResponse.json({
      url,
      expiresIn: PLAYBACK_TICKET_TTL_SECONDS,
      delivery,
      format: path.startsWith('private/streams/') ? 'aac' : 'legacy',
    }, {headers: {'Cache-Control': 'private, no-store, max-age=0'}});
  } catch (error) {
    console.error('Member stream failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
