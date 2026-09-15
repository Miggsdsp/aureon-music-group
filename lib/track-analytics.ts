'use client';
import {CLIENT_ANALYTICS_EVENTS,type ClientAnalyticsEventName} from './analytics-model';
import {analyticsConsent,getAnalyticsContext} from './analytics-attribution';

export type AnalyticsEvent = {
  eventType: ClientAnalyticsEventName;
  entityType?: string; entityId?: string; title?: string; slug?:string; genre?:string;
  artistId?: string; artistSlug?:string; artistName?: string; albumId?: string; albumSlug?:string; albumTitle?: string;
  productId?: string; productName?: string; playlistId?: string; playlistName?: string;
  durationSeconds?: number; listenedSeconds?: number; progressPercent?: number;
  referralCode?: string; searchQuery?: string; searchResultCount?: number; plan?: string;
  metricName?: string; metricValue?: number; metricRating?: string; metricId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

function deviceType() { const width = window.innerWidth; return width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop'; }
declare global{interface Window{dataLayer?:unknown[];gtag?:(...args:unknown[])=>void}}

export function trackAnalytics(event: AnalyticsEvent) {
  if(typeof window==='undefined'||!analyticsConsent()||!CLIENT_ANALYTICS_EVENTS.includes(event.eventType))return;
  const context=getAnalyticsContext();if(!context)return;
  const searchQuery=event.searchQuery&&(/@|\+?\d[\d\s().-]{7,}/.test(event.searchQuery)?'[redacted]':event.searchQuery.slice(0,100));
  const payload={...event,searchQuery,visitorId:context.visitorId,sessionId:context.sessionId,firstTouch:context.firstTouch,sessionTouch:context.sessionTouch,contentAttribution:context.content,locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,deviceType:deviceType(),pathname:window.location.pathname};
  const gaParams:Record<string,unknown>={content_type:event.entityType,content_id:event.entityId,content_name:event.title,song_slug:event.slug,artist_slug:event.artistSlug,artist_name:event.artistName,album_slug:event.albumSlug,genre:event.genre,progress_percent:event.progressPercent,search_term:searchQuery,plan:event.plan,source:context.firstTouch.source,medium:context.firstTouch.medium,campaign:context.firstTouch.campaign,...event.metadata};
  Object.keys(gaParams).forEach(key=>(gaParams[key]===''||gaParams[key]===undefined||gaParams[key]===null)&&delete gaParams[key]);
  window.gtag?.('event',event.eventType,gaParams);
  if(process.env.NODE_ENV!=='production'){if(process.env.NEXT_PUBLIC_ANALYTICS_DEBUG==='true')console.debug('[Aureon analytics]',event.eventType,gaParams);return}
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) { navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' })); return; }
  fetch('/api/analytics/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}
