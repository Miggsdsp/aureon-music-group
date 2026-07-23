import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
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
    if (!hasActivePlan(member)) return NextResponse.json({ error: 'An active Aureon membership is required.' }, { status: 403 });

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });

    const path = privatePath(song.data() || {});
    if (!path.startsWith('private/full-tracks/')) return NextResponse.json({ error: 'Full track is unavailable.' }, { status: 404 });

    const authorization = request.headers.get('authorization') || '';
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Member authentication is required.' }, { status: 401 });

    const url = `/api/member/audio/${encodeURIComponent(songId)}?token=${encodeURIComponent(token)}`;
    return NextResponse.json({ url, expiresIn: 3600 });
  } catch (error) {
    console.error('Member stream failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
