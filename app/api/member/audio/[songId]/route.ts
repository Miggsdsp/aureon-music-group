import { NextResponse } from 'next/server';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function privatePath(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return String(data.privateFilePath || details.privateFilePath || data.fullTrackPath || details.fullTrackPath || '').trim();
}

export async function GET(request: Request, context: { params: Promise<{ songId: string }> }) {
  try {
    const { member } = await requireMember(request);
    if (!hasActivePlan(member)) {
      return NextResponse.json({ error: 'An active Aureon membership is required.' }, { status: 403 });
    }

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') {
      return NextResponse.json({ error: 'Song not found.' }, { status: 404 });
    }

    const path = privatePath(song.data() || {});
    if (!path.startsWith('private/full-tracks/')) {
      return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });
    }

    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'audio/mpeg',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store, max-age=0',
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(String(song.data()?.title || 'aureon-track'))}.mp3"`,
      },
    });
  } catch (error) {
    console.error('Member audio failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
