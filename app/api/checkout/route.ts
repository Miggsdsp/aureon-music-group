import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { cleanText, clientIp, enforceRateLimit, validEmail, writeAuditLog } from '@/lib/server-security';

export const runtime = 'nodejs';

type CheckoutItem = { id: string; name?: string; artist?: string; quantity?: number; digital?: boolean };
type CheckoutBody = {
  email?: string; firstName?: string; surname?: string; phone?: string;
  deviceType?: string; trafficSource?: string; utmSource?: string;
  utmMedium?: string; utmCampaign?: string; landingPath?: string; items?: CheckoutItem[];
};
type ValidatedSong = { id: string; title: string; artist: string; priceCents: number };

const cleanReference = (value: unknown) => cleanText(value, 180).replace(/^SONG-/i, '');
const safeMetadata = (value: unknown, max = 150) => cleanText(value, max);

function getPriceCents(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const euros = Number(data.price ?? details.price);
  if (!Number.isFinite(euros) || euros < 0.5 || euros > 1000) throw new Error('INVALID_SONG_PRICE');
  return Math.round(euros * 100);
}

async function resolveSong(reference: string) {
  const songs = adminFirestore.collection('songs');
  const direct = await songs.doc(reference).get();
  if (direct.exists) return direct;
  const bySlug = await songs.where('slug', '==', reference).limit(1).get();
  return bySlug.empty ? null : bySlug.docs[0];
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  try {
    const allowed = await enforceRateLimit('checkout', ip, 20, 15 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Too many checkout attempts. Please try again shortly.' }, { status: 429 });

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 30_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });

    const body = (await request.json()) as CheckoutBody;
    const email = cleanText(body.email, 180).toLowerCase();
    const supplied = Array.isArray(body.items) ? body.items : [];
    const digitalItems = supplied.filter(item => item.digital === true && item.id).slice(0, 20);
    if (!validEmail(email) || !digitalItems.length) {
      return NextResponse.json({ error: 'A valid email and at least one song are required.' }, { status: 400 });
    }

    const uniqueReferences = [...new Set(digitalItems.map(item => cleanReference(item.id)).filter(Boolean))];
    const validatedSongs: ValidatedSong[] = await Promise.all(uniqueReferences.map(async reference => {
      const snapshot = await resolveSong(reference);
      if (!snapshot) throw new Error('SONG_NOT_FOUND');
      const data = snapshot.data() || {};
      const details = data.details && typeof data.details === 'object' ? data.details : {};
      const status = String(data.status || details.status || '').toLowerCase();
      const purchasable = data.purchasable !== false && details.purchasable !== false;
      const promotional = data.promotional === true || details.promotional === true;
      if (status !== 'published' || !purchasable || promotional) throw new Error('SONG_NOT_AVAILABLE');
      return {
        id: snapshot.id,
        title: cleanText(data.title || data.name || 'Aureon song', 180),
        artist: cleanText(data.artistName || data.artist || details.artistName || 'Aureon Music Group', 180),
        priceCents: getPriceCents(data),
      };
    }));

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', customer_creation: 'always', customer_email: email,
      billing_address_collection: 'required', allow_promotion_codes: false,
      line_items: validatedSongs.map(song => ({
        quantity: 1,
        price_data: {
          currency: 'eur', unit_amount: song.priceCents,
          product_data: { name: song.title, description: `${song.artist} · Full digital music download`, metadata: { songId: song.id } },
        },
      })),
      metadata: {
        firstName: safeMetadata(body.firstName, 100), surname: safeMetadata(body.surname, 100), phone: safeMetadata(body.phone, 50),
        songIds: validatedSongs.map(song => song.id).join(','), deviceType: safeMetadata(body.deviceType || 'Not captured', 50),
        trafficSource: safeMetadata(body.trafficSource || 'Direct', 120), utmSource: safeMetadata(body.utmSource, 100),
        utmMedium: safeMetadata(body.utmMedium, 100), utmCampaign: safeMetadata(body.utmCampaign, 100),
        landingPath: safeMetadata(body.landingPath, 180), requestIp: ip,
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    await writeAuditLog('checkout.created', { sessionId: session.id, ip, email, songIds: validatedSongs.map(song => song.id) });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'SONG_NOT_FOUND') return NextResponse.json({ error: 'One of the selected songs no longer exists.' }, { status: 404 });
    if (code === 'SONG_NOT_AVAILABLE') return NextResponse.json({ error: 'One of the selected songs is not currently available to purchase.' }, { status: 409 });
    if (code === 'INVALID_SONG_PRICE') return NextResponse.json({ error: 'One of the selected songs has an invalid price. Please contact Aureon support.' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to start secure payment.' }, { status: 500 });
  }
}
