import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function playbackPath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const stream = String(data.streamFilePath || details.streamFilePath || '').trim();
  if (stream.startsWith('private/streams/')) return stream;

  // Keep existing catalogue playable until legacy tracks are reprocessed.
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

function parseRange(value: string | null, size: number) {
  if (!value?.startsWith('bytes=')) return null;
  const [startValue, endValue] = value.slice(6).split('-', 2);
  const start = startValue ? Number(startValue) : 0;
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request, context: { params: Promise<{ songId: string }> }) {
  try {
    const requestUrl = new URL(request.url);
    const queryToken = requestUrl.searchParams.get('token') || '';
    const authenticatedRequest = queryToken
      ? new Request(request.url, { headers: { authorization: `Bearer ${queryToken}` } })
      : request;

    const { member } = await requireMember(authenticatedRequest);
    if (!hasActivePlan(member)) {
      return NextResponse.json({ error: 'An active Aureon membership is required.' }, { status: 403 });
    }

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') {
      return NextResponse.json({ error: 'Song not found.' }, { status: 404 });
    }

    const path = playbackPath(song.data() || {});
    if (!path.startsWith('private/streams/') && !path.startsWith('private/full-tracks/')) {
      return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });
    }

    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size || 0);
    if (!size) return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });

    const contentType = String(metadata.contentType || (path.endsWith('.aac') ? 'audio/aac' : 'audio/mpeg'));
    const range = parseRange(request.headers.get('range'), size);
    const start = range?.start ?? 0;
    const end = range?.end ?? size - 1;
    const length = end - start + 1;
    const nodeStream = file.createReadStream({ start, end, validation: false });
    const stream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(stream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(length),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(song.data()?.title || 'aureon-track'))}"`,
        'X-Content-Type-Options': 'nosniff',
        'X-Aureon-Stream-Source': path.startsWith('private/streams/') ? 'compressed' : 'legacy-master',
      },
    });
  } catch (error) {
    console.error('Member audio failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
