import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { cleanText, clientIp, enforceRateLimit, validEmail, writeAuditLog } from '@/lib/server-security';

export const runtime = 'nodejs';

type CheckoutItem = { id: string; name?: string; artist?: string; quantity?: number; digital?: boolean; size?: string; colour?: string };
type DeliveryAddress = { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string };
type CheckoutBody = {
  email?: string; firstName?: string; surname?: string; phone?: string; deliveryAddress?: DeliveryAddress;
  deviceType?: string; trafficSource?: string; utmSource?: string;
  utmMedium?: string; utmCampaign?: string; landingPath?: string; items?: CheckoutItem[];
};
type ValidatedItem = { id: string; name: string; description: string; priceCents: number; quantity: number; digital: boolean; size?: string; colour?: string };

const cleanReference = (value: unknown) => cleanText(value, 180).replace(/^SONG-/i, '');
const safeMetadata = (value: unknown, max = 150) => cleanText(value, max);
const listValue = (value: unknown) => Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : String(value || '').split(',').map(item => item.trim()).filter(Boolean);
const objectValue = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

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

async function firstByField(collectionName: 'songs'|'products', field: string, value: string) {
  if (!value) return null;
  const result = await adminFirestore.collection(collectionName).where(field, '==', value).limit(1).get();
  return result.empty ? null : result.docs[0];
}

async function resolveSong(reference: string, suppliedName?: string) {
  const songs = adminFirestore.collection('songs');
  const direct = await songs.doc(reference).get();
  if (direct.exists) return direct;
  for (const field of ['slug', 'songId', 'aureonId', 'id']) { const match = await firstByField('songs', field, reference); if (match) return match; }
  const name = cleanText(suppliedName, 180);
  if (name) for (const field of ['title', 'name']) { const match = await firstByField('songs', field, name); if (match) return match; }
  return null;
}

async function resolveProduct(reference: string, suppliedName?: string) {
  const products = adminFirestore.collection('products');
  const direct = await products.doc(reference).get();
  if (direct.exists) return direct;
  for (const field of ['slug', 'productId', 'sku', 'aureonId', 'id']) { const match = await firstByField('products', field, reference); if (match) return match; }
  const name = cleanText(suppliedName, 180);
  if (name) for (const field of ['name', 'title']) { const match = await firstByField('products', field, name); if (match) return match; }
  return null;
}

function cleanDeliveryAddress(value: DeliveryAddress | undefined) {
  if (!value) return null;
  const address = {
    line1: cleanText(value.line1, 180), line2: cleanText(value.line2, 180), city: cleanText(value.city, 100),
    region: cleanText(value.region, 100), postalCode: cleanText(value.postalCode, 30), country: cleanText(value.country, 2).toUpperCase(),
  };
  if (!address.line1 || !address.city || !address.postalCode || !address.country) return null;
  return address;
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

      const snapshot = await resolveProduct(reference, item.name);
      if (!snapshot) throw new Error('ITEM_NOT_FOUND');
      const data = snapshot.data() || {};
      const details = objectValue(data.details);
      const status = String(data.status || 'published').toLowerCase();
      if (!['published', 'active', 'live'].includes(status) || data.available === false || details.available === false) throw new Error('ITEM_NOT_AVAILABLE');

      const sizes = listValue(data.sizes ?? details.sizes);
      const colours = listValue(data.colours ?? details.colours);
      const size = safeMetadata(item.size, 40);
      const colour = safeMetadata(item.colour, 60);
      if (sizes.length && (!size || !sizes.includes(size))) throw new Error('SIZE_REQUIRED');
      if (colours.length && colour && !colours.includes(colour)) throw new Error('INVALID_VARIANT');

      const requestedQty = Math.min(10, Math.max(1, Math.floor(Number(item.quantity || 1))));
      const sizeStockRaw = objectValue(data.sizeStock ?? details.sizeStock);
      const sizeStock = Object.fromEntries(Object.entries(sizeStockRaw).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]));
      const hasSizeStock = Object.keys(sizeStock).length > 0;
      const totalStockRaw = data.stock ?? details.stock;
      const totalStock = totalStockRaw === undefined || totalStockRaw === null || totalStockRaw === '' ? null : Math.max(0, Math.floor(Number(totalStockRaw) || 0));
      const availableQty = hasSizeStock ? Number(sizeStock[size] || 0) : totalStock;
      if (availableQty !== null && availableQty <= 0) throw new Error('OUT_OF_STOCK');
      if (availableQty !== null && requestedQty > availableQty) throw new Error('STOCK_EXCEEDED');

      const base = getPriceCents(data);
      const discounted = Math.max(50, Math.round(base * (100 - discount.percent) / 100));
      const variant = [size ? `Size ${size}` : '', colour].filter(Boolean).join(' · ');
      return { id: snapshot.id, name: cleanText(data.name || data.title || 'Aureon merchandise', 180), description: `${discount.percent ? `Official Aureon merchandise · ${discount.percent}% member discount applied` : 'Official Aureon merchandise'}${variant ? ` · ${variant}` : ''}`, priceCents: discounted, quantity: requestedQty, digital: false, size: size || undefined, colour: colour || undefined };
    }));

    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const hasPhysical = validated.some(item => !item.digital);
    const songs = validated.filter(item => item.digital);
    const products = validated.filter(item => !item.digital);
    const deliveryAddress = hasPhysical ? cleanDeliveryAddress(body.deliveryAddress) : null;
    if (hasPhysical && !deliveryAddress) return NextResponse.json({ error: 'A complete delivery address is required for merchandise orders.' }, { status: 400 });

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment', customer_creation: 'always', customer_email: email,
      billing_address_collection: 'required',
      allow_promotion_codes: false,
      line_items: validated.map(item => ({ quantity: item.quantity, price_data: { currency: 'eur', unit_amount: item.priceCents, product_data: { name: item.name, description: item.description, metadata: { itemId: item.id, itemType: item.digital ? 'song' : 'merchandise', size: item.size || '', colour: item.colour || '' } } } })),
      metadata: {
        firstName: safeMetadata(body.firstName, 100), surname: safeMetadata(body.surname, 100), phone: safeMetadata(body.phone, 50),
        songIds: songs.map(item => item.id).join(','), productIds: products.map(item => item.id).join(','), orderType: hasPhysical ? (songs.length ? 'mixed' : 'merchandise') : 'digital',
        memberUid: discount.uid, memberDiscountPercent: String(discount.percent), deviceType: safeMetadata(body.deviceType || 'Not captured', 50),
        trafficSource: safeMetadata(body.trafficSource || 'Direct', 120), utmSource: safeMetadata(body.utmSource, 100), utmMedium: safeMetadata(body.utmMedium, 100), utmCampaign: safeMetadata(body.utmCampaign, 100), landingPath: safeMetadata(body.landingPath, 180), requestIp: ip,
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    await adminFirestore.collection('orders').doc(session.id).set({
      stripeCheckoutSessionId: session.id, status: 'pending_payment', paymentStatus: session.payment_status,
      customerEmail: email, customerName: `${safeMetadata(body.firstName,100)} ${safeMetadata(body.surname,100)}`.trim(), customerPhone: safeMetadata(body.phone,50),
      deliveryAddress: deliveryAddress || null,
      items: validated.map(item => ({ id:item.id, name:item.name, quantity:item.quantity, priceCents:item.priceCents, digital:item.digital, size:item.size || '', colour:item.colour || '' })),
      songIds: songs.map(item=>item.id), productIds: products.map(item=>item.id), orderType: hasPhysical ? (songs.length ? 'mixed' : 'merchandise') : 'digital',
      memberUid: discount.uid, memberDiscountPercent: discount.percent, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await writeAuditLog('checkout.created', { sessionId: session.id, ip, email, itemIds: validated.map(item => item.id), memberDiscountPercent: discount.percent });
    return NextResponse.json({ url: session.url, discountPercent: discount.percent });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'ITEM_NOT_FOUND') return NextResponse.json({ error: 'One of the selected items no longer exists.' }, { status: 404 });
    if (code === 'ITEM_NOT_AVAILABLE') return NextResponse.json({ error: 'One of the selected items is not currently available.' }, { status: 409 });
    if (code === 'SIZE_REQUIRED') return NextResponse.json({ error: 'Please select an available size before checkout.' }, { status: 409 });
    if (code === 'INVALID_VARIANT') return NextResponse.json({ error: 'The selected product option is not available.' }, { status: 409 });
    if (code === 'OUT_OF_STOCK') return NextResponse.json({ error: 'One of the selected merchandise items is sold out.' }, { status: 409 });
    if (code === 'STOCK_EXCEEDED') return NextResponse.json({ error: 'The requested quantity is greater than the available stock.' }, { status: 409 });
    if (code === 'INVALID_PRICE') return NextResponse.json({ error: 'One of the selected items has an invalid price. Please contact Aureon support.' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to start secure payment.' }, { status: 500 });
  }
}
