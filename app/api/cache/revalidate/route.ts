import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const pathsByType: Record<string, string[]> = {
  artists: ['/', '/artists', '/music'],
  albums: ['/', '/music'],
  songs: ['/', '/music', '/artists'],
  videos: ['/', '/videos'],
  newsArticles: ['/', '/news'],
  videoAlbums: ['/', '/videos'],
};

async function requireAdmin(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new Error('UNAUTHENTICATED');
  const decoded = await adminAuth.verifyIdToken(token);
  const primary = await adminFirestore.collection('admins').doc(decoded.uid).get();
  const legacy = primary.exists ? primary : await adminFirestore.collection('admin').doc(decoded.uid).get();
  if (!legacy.exists || legacy.data()?.active !== true) throw new Error('FORBIDDEN');
  return decoded.uid;
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const collectionName = String(body.collectionName || '');
    const slug = String(body.slug || '').trim();
    const extraPaths = Array.isArray(body.paths) ? body.paths.map(String) : [];
    const paths = new Set([...(pathsByType[collectionName] || ['/']), ...extraPaths]);

    if (slug) {
      if (collectionName === 'artists') paths.add(`/artists/${slug}`);
      if (collectionName === 'albums') paths.add(`/music/${slug}`);
      if (collectionName === 'songs') paths.add(`/songs/${slug}`);
      if (collectionName === 'videos' || collectionName === 'videoAlbums') paths.add(`/videos/${slug}`);
      if (collectionName === 'newsArticles') paths.add(`/news/${slug}`);
    }

    for (const path of paths) revalidatePath(path);
    if (collectionName) revalidateTag(`collection:${collectionName}`);
    if (slug) revalidateTag(`${collectionName}:${slug}`);

    return NextResponse.json({ revalidated: true, paths: [...paths] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revalidate cache.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
