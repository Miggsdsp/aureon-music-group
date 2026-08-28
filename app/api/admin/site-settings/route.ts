import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';

async function requireActiveAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) throw new Error('UNAUTHENTICATED');

  const decoded = await adminAuth.verifyIdToken(token);
  let adminSnapshot = await adminFirestore.collection('admins').doc(decoded.uid).get();
  if (!adminSnapshot.exists) {
    adminSnapshot = await adminFirestore.collection('admin').doc(decoded.uid).get();
  }

  if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
    throw new Error('FORBIDDEN');
  }

  return decoded;
}

export async function POST(request: NextRequest) {
  try {
    await requireActiveAdmin(request);
    const body = await request.json();

    const allowedKeys = [
      'merchandiseEnabled', 'siteName', 'supportEmail', 'announcement',
      'headerLogoUrl', 'footerLogoUrl', 'faviconUrl',
      'heroVideoUrl', 'heroPosterUrl', 'heroOverlayOpacity',
      'heroLightEffects', 'heroDustEffects', 'heroLedEffects', 'heroLogoScale',
      'featuredArtistId', 'featuredSongId', 'featuredAlbumId', 'featuredVideoId',
      'featuredNewsId', 'termsPageId', 'privacyPageId', 'licensingPageId',
      'spotifyUrl', 'youtubeUrl', 'instagramUrl', 'tiktokUrl', 'appleMusicUrl',
      'facebookUrl', 'xUrl'
    ];

    const settings = Object.fromEntries(
      allowedKeys
        .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
        .map((key) => [key, body[key]])
    );

    await adminFirestore.collection('siteSettings').doc('platform').set({
      ...settings,
      title: 'Platform settings',
      slug: 'platform',
      status: 'published',
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
