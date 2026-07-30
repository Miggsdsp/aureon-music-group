import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

const allowedEvents = new Set([
  'song_play','song_pause','song_complete','preview_complete','song_cart_add',
  'merch_view','merch_cart_add','album_view','artist_view','video_view'
]);

function clean(value: unknown, max = 180) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = clean(body.eventType, 40);
    if (!allowedEvents.has(eventType)) return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });

    const country = clean(request.headers.get('x-vercel-ip-country') || body.country || 'Unknown', 8);
    const region = clean(request.headers.get('x-vercel-ip-country-region') || body.region || 'Unknown', 80);
    const city = clean(request.headers.get('x-vercel-ip-city') || body.city || 'Unknown', 100);
    const event = {
      eventType,
      entityType: clean(body.entityType, 30),
      entityId: clean(body.entityId, 160),
      title: clean(body.title),
      artistId: clean(body.artistId, 160),
      artistName: clean(body.artistName),
      albumId: clean(body.albumId, 160),
      albumTitle: clean(body.albumTitle),
      productId: clean(body.productId, 160),
      productName: clean(body.productName),
      durationSeconds: Math.max(0, Math.min(86400, Number(body.durationSeconds || 0))),
      listenedSeconds: Math.max(0, Math.min(86400, Number(body.listenedSeconds || 0))),
      progressPercent: Math.max(0, Math.min(100, Number(body.progressPercent || 0))),
      sessionId: clean(body.sessionId, 120),
      memberId: clean(body.memberId, 160),
      country, region, city,
      locale: clean(body.locale, 40),
      timezone: clean(body.timezone, 80),
      deviceType: clean(body.deviceType, 30),
      pathname: clean(body.pathname, 300),
      referrer: clean(body.referrer, 500),
      userAgent: clean(request.headers.get('user-agent'), 500),
      createdAt: FieldValue.serverTimestamp(),
      receivedAt: new Date().toISOString()
    };

    await adminFirestore.collection('analyticsEvents').add(event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('analytics track failed', error);
    return NextResponse.json({ error: 'Unable to record analytics event' }, { status: 500 });
  }
}
