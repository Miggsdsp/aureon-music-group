import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';

type CheckoutItem = {
  id: string;
  name: string;
  artist?: string;
  quantity?: number;
  digital?: boolean;
};

type CheckoutBody = {
  email?: string;
  firstName?: string;
  surname?: string;
  phone?: string;
  items?: CheckoutItem[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const items = Array.isArray(body.items) ? body.items : [];
    const digitalItems = items.filter(item => item.digital === true && item.id && item.name);

    if (!body.email || !digitalItems.length) {
      return NextResponse.json({ error: 'Customer email and at least one song are required.' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_creation: 'always',
      customer_email: body.email,
      billing_address_collection: 'auto',
      allow_promotion_codes: false,
      line_items: digitalItems.map(item => ({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: 99,
          product_data: {
            name: item.name,
            description: `${item.artist || 'Aureon Music Group'} · Full digital music download`,
            metadata: { songId: item.id }
          }
        }
      })),
      metadata: {
        firstName: body.firstName || '',
        surname: body.surname || '',
        phone: body.phone || '',
        songIds: digitalItems.map(item => item.id).join(',')
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Unable to start secure payment.' }, { status: 500 });
  }
}
