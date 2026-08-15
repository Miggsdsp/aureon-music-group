import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { cleanText, clientIp, enforceRateLimit, validEmail, writeAuditLog } from '@/lib/server-security';

export const runtime = 'nodejs';

type CheckoutItem = { id: string; name?: string; artist?: string; quantity?: number; digital?: boolean };
type CheckoutBody = {
  email?: string; firstName?: string; surname?: string; phone?: string;
  deviceType?: string; trafficSource?: string; utmSource?: string;
  utmMedium?: string; utmCampaign?: string; landingPath?: string; items?: CheckoutItem[];
};
type ValidatedItem = { id: string; name: string; description: string; priceCents: number; quantity: number; digital: boolean };

const cleanReference = (value: unknown) => cleanText(value, 180).replace(/^SONG-/i, '');
const safeMetadata = (value: unknown, max = 150) => cleanText(value, max);

function getPriceCents(data: Record<string, any>) {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const euros = Number(data.price ?? details.price);
  if (!Number.isFinite(euros) || euros < 0.5 || euros > 5000) throw new Error('INVALID_PRICE');
  return Math.round(euros * 100);
}

async function memberDiscount(request: Request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return { percent: 0, uid: '' };
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7).trim());
    const snapshot = await adminFirestore.collection('members').doc(decoded.uid).get();
    const member = snapshot.data() || {};
    const status = String(member.subscriptionStatus || '').toLowerCase();
    if (!['active', 'trialing'].includes(status) || member.subscriptionActive !== true) return { percent: 0, uid: decoded.uid };
    return { percent: String(member.plan || '').toLowerCase() === 'creator' ? 20 : 10, uid: decoded.uid };
  } catch { return { percent: 0, uid: '' }; }
}

async function firstSongByField(field: string, value: string) {
  if (!value) return null;
  const result = await adminFirestore.collection('songs').where(field, '==', value).limit(1).get();
  return result.empty ? null : result.docs[0];
}

async function resolveSong(reference: string, suppliedName?: string) {
  const songs = adminFirestore.collection('songs');
  const direct = await songs.doc(reference).get();
  if (direct.exists) return direct;

  // Current catalogue uses slugs, while older carts/releases may contain a
  // legacy song ID. Support both without trusting any client-supplied price.
  for (const field of ['slug', 'songId', 'aureonId', 'id']) {
    const match = await firstSongByField(field, reference);
    if (match) return match;
  }

  // Some pre-launch carts stored a display/title-derived identifier. Use the
  // supplied display name only to locate the canonical Firestore song record;
  // price, publication state and availability are still read server-side.
  const name = cleanText(suppliedName, 180);
  if (name) {
    for (const field of ['title', 'name']) {
      const match = await firstSongByField(field, name);
      if (match) return match;
    }
  }

  return null;
}

async function resolveProduct(reference: string) {
  const products = adminFirestore.collection('products');
  const direct = await products.doc(reference).get();
  if (direct.exists) return direct;
  const bySlug = await products.where('slug', '==', reference).limit(1).get();
  return bySlug.empty ? null : bySlug.docs[0];
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  try {
    const allowed = await enforceRateLimit('checkout', ip, 20, 15 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Too many checkout attempts. Please try again shortly.' }, { status: 429 });
    const body = (await request.json()) as CheckoutBody;
    const email = cleanText(body.email, 180).toLowerCase();
    const supplied = Array.isArray(body.items) ? body.items.filter(item => item?.id).slice(0, 30) : [];
    if (!validEmail(email) || !supplied.length) return NextResponse.json({ error: 'A valid email and at least one item are required.' }, { status: 400 });

    const discount = await memberDiscount(request);
    const validated: ValidatedItem[] = await Promise.all(supplied.map(async item => {
      const reference = cleanReference(item.id);
      if (item.digital === true) {
        const snapshot = await resolveSong(reference, item.name);
        if (!snapshot) throw new Error('ITEM_NOT_FOUND');
        const data = snapshot.data() || {};
        if (String(data.status || '').toLowerCase() !== 'published' || data.purchasable === false || data.promotional === true) throw new Error('ITEM_NOT_AVAILABLE');
        return { id: snapshot.id, name: cleanText(data.title || data.name || 'Aureon song', 180), description: `${cleanText(data.artistName || data.artist || 'Aureon Music Group', 180)} · Full digital music download`, priceCents: getPriceCents(data), quantity: 1, digital: true };
      }
      const snapshot = await resolveProduct(reference);
      if (!snapshot) throw new Error('ITEM_NOT_FOUND');
      const data = snapshot.data() || {};
      const status = String(data.status || 'published').toLowerCase();
      if (!['published', 'active', 'live'].includes(status) || data.available === false) throw new Error('ITEM_NOT_AVAILABLE');
      const base = getPriceCents(data);
      const discounted = Math.max(50, Math.round(base * (100 - discount.percent) / 100));
      return { id: snapshot.id, name: cleanText(data.name || data.title || 'Aureon merchandise', 180), description: discount.percent ? `Official Aureon merchandise · ${discount.percent}% member discount applied` : 'Official Aureon merchandise', priceCents: discounted, quantity: Math.min(10, Math.max(1, Number(item.quantity || 1))), digital: false };
    }));

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const hasPhysical = validated.some(item => !item.digital);
    const songs = validated.filter(item => item.digital);
    const products = validated.filter(item => !item.digital);
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment', customer_creation: 'always', customer_email: email,
      billing_address_collection: 'required',
      ...(hasPhysical ? { shipping_address_collection: { allowed_countries: ['IE','GB','PT','ES','FR','DE','NL','BE','IT','US','CA','AU','NZ','ZA'] as any } } : {}),
      allow_promotion_codes: false,
      line_items: validated.map(item => ({ quantity: item.quantity, price_data: { currency: 'eur', unit_amount: item.priceCents, product_data: { name: item.name, description: item.description, metadata: { itemId: item.id, itemType: item.digital ? 'song' : 'merchandise' } } } })),
      metadata: {
        firstName: safeMetadata(body.firstName, 100), surname: safeMetadata(body.surname, 100), phone: safeMetadata(body.phone, 50),
        songIds: songs.map(item => item.id).join(','), productIds: products.map(item => item.id).join(','), orderType: hasPhysical ? (songs.length ? 'mixed' : 'merchandise') : 'digital',
        memberUid: discount.uid, memberDiscountPercent: String(discount.percent), deviceType: safeMetadata(body.deviceType || 'Not captured', 50),
        trafficSource: safeMetadata(body.trafficSource || 'Direct', 120), utmSource: safeMetadata(body.utmSource, 100), utmMedium: safeMetadata(body.utmMedium, 100), utmCampaign: safeMetadata(body.utmCampaign, 100), landingPath: safeMetadata(body.landingPath, 180), requestIp: ip,
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    await writeAuditLog('checkout.created', { sessionId: session.id, ip, email, itemIds: validated.map(item => item.id), memberDiscountPercent: discount.percent });
    return NextResponse.json({ url: session.url, discountPercent: discount.percent });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'ITEM_NOT_FOUND') return NextResponse.json({ error: 'One of the selected items no longer exists.' }, { status: 404 });
    if (code === 'ITEM_NOT_AVAILABLE') return NextResponse.json({ error: 'One of the selected items is not currently available.' }, { status: 409 });
    if (code === 'INVALID_PRICE') return NextResponse.json({ error: 'One of the selected items has an invalid price. Please contact Aureon support.' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to start secure payment.' }, { status: 500 });
  }
}
