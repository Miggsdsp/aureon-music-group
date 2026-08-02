import { NextResponse } from 'next/server';
import { hasActivePlan, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = await requireMember(request);
    return NextResponse.json({
      authenticated: true,
      active: hasActivePlan(context.member),
      plan: String(context.member.plan || ''),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({
      authenticated: false,
      active: false,
      plan: '',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
