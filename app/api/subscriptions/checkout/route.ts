import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember, type MemberPlan } from '@/lib/member-server';

export const runtime = 'nodejs';

const prices: Record<MemberPlan, string | undefined> = {
  listener: process.env.STRIPE_LISTENER_PRICE_ID,
  creator: process.env.STRIPE_CREATOR_PRICE_ID,
};

export async function POST(request: Request) {
  try {
    const { uid, email, name, memberRef, member } = await requireMember(request);
    const body = await request.json();
    const plan = String(body?.plan || '') as MemberPlan;
    if (!['listener', 'creator'].includes(plan)) {
      return NextResponse.json({ error: 'Choose a valid membership plan.' }, { status: 400 });
    }

    const price = prices[plan];
    if (!price) return NextResponse.json({ error: `${plan} Stripe price is not configured.` }, { status: 500 });

    const stripe = getStripe();
    let customerId = String(member.stripeCustomerId || '');
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: name || undefined,
        metadata: { firebaseUid: uid },
      });
      customerId = customer.id;
      await memberRef.set({
        uid,
        email,
        name,
        stripeCustomerId: customerId,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      success_url: `${siteUrl}/account?subscription=success`,
      cancel_url: `${siteUrl}/membership?subscription=cancelled`,
      metadata: { firebaseUid: uid, plan },
      subscription_data: { metadata: { firebaseUid: uid, plan } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Subscription checkout failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
