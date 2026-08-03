import { NextRequest, NextResponse } from 'next/server';
import { ANALYTICS_EVENTS, recordAnalyticsEvent, type AnalyticsEventType } from '@/lib/analytics-server';

const allowedEvents = new Set<string>(ANALYTICS_EVENTS);
const clean = (value: unknown, max = 180) => String(value || '').trim().slice(0, max);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = clean(body.eventType, 50);
    if (!allowedEvents.has(eventType)) return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });

    await recordAnalyticsEvent({
      ...body,
      eventType: eventType as AnalyticsEventType,
      country: request.headers.get('x-vercel-ip-country') || body.country || 'Unknown',
      region: request.headers.get('x-vercel-ip-country-region') || body.region || 'Unknown',
      city: request.headers.get('x-vercel-ip-city') || body.city || 'Unknown',
      userAgent: request.headers.get('user-agent') || '',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('analytics track failed', error);
    return NextResponse.json({ error: 'Unable to record analytics event' }, { status: 500 });
  }
}
