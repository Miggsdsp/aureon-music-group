import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

function getReturnUrl(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configured = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim();

  if (!configured) return `${requestOrigin}/account`;

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol.');
    }
    return `${parsed.origin}/account`;
  } catch {
    console.warn('NEXT_PUBLIC_SITE_URL is not a valid absolute URL. Using the current request origin instead.');
    return `${requestOrigin}/account`;
  }
}

export async function POST(request: Request) {
  try {
    const { member } = await requireMember(request);
    const customer = String(member.stripeCustomerId || '').trim();
    if (!customer) {
      return NextResponse.json({ error: 'No Stripe customer exists for this account.' }, { status: 400 });
    }
    if (!customer.startsWith('cus_')) {
      return NextResponse.json({ error: 'The Stripe customer ID saved for this account is invalid.' }, { status: 409 });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: getReturnUrl(request),
    });

    if (!session.url || !session.url.startsWith('https://billing.stripe.com/')) {
      return NextResponse.json({ error: 'Stripe did not return a valid billing portal link.' }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
