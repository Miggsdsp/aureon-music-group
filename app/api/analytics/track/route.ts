import { NextRequest, NextResponse } from 'next/server';
import {analyticsContextFromBody,recordAnalyticsEvent,type AnalyticsEventType} from '@/lib/analytics-server';
import {CLIENT_ANALYTICS_EVENTS} from '@/lib/analytics-model';

const allowedEvents = new Set<string>(CLIENT_ANALYTICS_EVENTS);
const clean = (value: unknown, max = 180) => String(value || '').trim().slice(0, max);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = clean(body.eventType, 50);
    if (!allowedEvents.has(eventType)) return NextResponse.json({ error: 'Unsupported event' }, { status: 400 });

    const context=analyticsContextFromBody(body);
    if(!context.analyticsConsent)return NextResponse.json({ok:true,recorded:false});
    await recordAnalyticsEvent({
      eventType: eventType as AnalyticsEventType,
      entityType:clean(body.entityType,30),entityId:clean(body.entityId,160),title:clean(body.title),slug:clean(body.slug,160),genre:clean(body.genre,100),
      artistId:clean(body.artistId,160),artistSlug:clean(body.artistSlug,160),artistName:clean(body.artistName),albumId:clean(body.albumId,160),albumSlug:clean(body.albumSlug,160),albumTitle:clean(body.albumTitle),
      productId:clean(body.productId,160),productName:clean(body.productName),playlistId:clean(body.playlistId,160),playlistName:clean(body.playlistName),referralCode:clean(body.referralCode,80),searchQuery:clean(body.searchQuery,100),searchResultCount:Number(body.searchResultCount||0),plan:clean(body.plan,40),
      durationSeconds:Number(body.durationSeconds||0),listenedSeconds:Number(body.listenedSeconds||0),progressPercent:Number(body.progressPercent||0),locale:clean(body.locale,40),timezone:clean(body.timezone,80),deviceType:clean(body.deviceType,30),pathname:clean(body.pathname,300),metricName:clean(body.metricName,30),metricValue:Number(body.metricValue||0),metricRating:clean(body.metricRating,30),metricId:clean(body.metricId,120),metadata:body.metadata,
      ...context,country:request.headers.get('x-vercel-ip-country')||'Unknown',region:request.headers.get('x-vercel-ip-country-region')||'Unknown',city:request.headers.get('x-vercel-ip-city')||'Unknown',userAgent:request.headers.get('user-agent')||'',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('analytics track failed', error);
    return NextResponse.json({ error: 'Unable to record analytics event' }, { status: 500 });
  }
}
