import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe-server';
import { memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { member } = await requireMember(request);
    const customer = String(member.stripeCustomerId || '');
    if (!customer) return NextResponse.json({ error: 'No Stripe customer exists for this account.' }, { status: 400 });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${siteUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
