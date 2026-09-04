import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore, adminStorage } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'playlist-image';
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const form = await request.formData();
    const playlistId = String(form.get('playlistId') || '').trim();
    const image = form.get('image');

    if (!playlistId || playlistId.includes('/') || playlistId.includes('..')) {
      return NextResponse.json({ error: 'Invalid playlist.' }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Choose an image first.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      return NextResponse.json({ error: 'Playlist images must be JPG, PNG or WebP.' }, { status: 400 });
    }
    if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Playlist images must be smaller than 5 MB.' }, { status: 400 });
    }

    const playlistRef = adminFirestore.doc(`members/${uid}/playlists/${playlistId}`);
    const playlist = await playlistRef.get();
    if (!playlist.exists) return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });

    const bucket = adminStorage.bucket();
    const objectPath = `member-playlists/${uid}/${playlistId}/${Date.now()}-${safeName(image.name)}`;
    const file = bucket.file(objectPath);
    const bytes = Buffer.from(await image.arrayBuffer());
    await file.save(bytes, {
      resumable: false,
      metadata: {
        contentType: image.type,
        cacheControl: 'public,max-age=31536000,immutable',
      },
    });

    const [imageUrl] = await file.getSignedUrl({ action: 'read', expires: '2100-01-01' });
    await playlistRef.update({ imageUrl, updatedAt: new Date() });

    return NextResponse.json({ ok: true, imageUrl });
  } catch (error) {
    console.error('Playlist image upload failed', error);
    return NextResponse.json({ error: 'Unable to upload the playlist image.' }, { status: 500 });
  }
}
