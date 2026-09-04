import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function authenticate(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) throw new Error('AUTH_REQUIRED');
  return adminAuth.verifyIdToken(token);
}

async function assertPaidMember(uid: string) {
  const member = await adminFirestore.doc(`members/${uid}`).get();
  const data = member.data() || {};
  const status = String(data.subscriptionStatus || '').toLowerCase();
  const plan = String(data.plan || '').toLowerCase();
  if (!member.exists || !['active', 'trialing'].includes(status) || !['listener', 'creator'].includes(plan)) {
    throw new Error('MEMBERSHIP_REQUIRED');
  }
}

function cleanId(value: string) {
  const id = String(value || '').trim();
  if (!id || id.includes('/') || id.includes('..')) throw new Error('INVALID_ID');
  return id;
}

export async function POST(request: NextRequest, context: { params: Promise<{ playlistId: string }> }) {
  try {
    const decoded = await authenticate(request);
    await assertPaidMember(decoded.uid);
    const { playlistId: rawPlaylistId } = await context.params;
    const playlistId = cleanId(rawPlaylistId);
    const body = await request.json();
    const songId = cleanId(body?.songId);

    const playlistRef = adminFirestore.doc(`members/${decoded.uid}/playlists/${playlistId}`);
    const songRef = adminFirestore.doc(`songs/${songId}`);

    const result = await adminFirestore.runTransaction(async transaction => {
      const [playlistSnap, songSnap] = await Promise.all([
        transaction.get(playlistRef),
        transaction.get(songRef),
      ]);
      if (!playlistSnap.exists) throw new Error('PLAYLIST_NOT_FOUND');
      if (!songSnap.exists || String(songSnap.data()?.status || '').toLowerCase() !== 'published') {
        throw new Error('SONG_NOT_FOUND');
      }

      const currentIds = Array.isArray(playlistSnap.data()?.songIds)
        ? playlistSnap.data()!.songIds.filter((id: unknown) => typeof id === 'string')
        : [];
      if (currentIds.includes(songId)) return { added: false, songIds: currentIds };

      const songIds = [...currentIds, songId];
      transaction.update(playlistRef, { songIds, updatedAt: new Date() });
      return { added: true, songIds };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTH_REQUIRED') return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (code === 'MEMBERSHIP_REQUIRED') return NextResponse.json({ error: 'An active Aureon membership is required.' }, { status: 403 });
    if (code === 'PLAYLIST_NOT_FOUND') return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });
    if (code === 'SONG_NOT_FOUND') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });
    if (code === 'INVALID_ID') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    console.error('Add song to playlist failed', error);
    return NextResponse.json({ error: 'Unable to add this song to your playlist.' }, { status: 500 });
  }
}
