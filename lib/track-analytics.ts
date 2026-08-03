'use client';

export type AnalyticsEvent = {
  eventType: 'song_play'|'song_pause'|'song_complete'|'preview_complete'|'song_cart_add'|'merch_view'|'merch_cart_add'|'album_view'|'artist_view'|'video_view'|'core_web_vital';
  entityType?: string;
  entityId?: string;
  title?: string;
  artistId?: string;
  artistName?: string;
  albumId?: string;
  albumTitle?: string;
  productId?: string;
  productName?: string;
  durationSeconds?: number;
  listenedSeconds?: number;
  progressPercent?: number;
  memberId?: string;
  metricName?: string;
  metricValue?: number;
  metricRating?: string;
  metricId?: string;
};

function sessionId() {
  const key = 'aureon-analytics-session';
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
}

function deviceType() {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1100) return 'tablet';
  return 'desktop';
}

export function trackAnalytics(event: AnalyticsEvent) {
  if (typeof window === 'undefined') return;
  const payload = {
    ...event,
    sessionId: sessionId(),
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceType: deviceType(),
    pathname: window.location.pathname,
    referrer: document.referrer
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' }));
    return;
  }
  fetch('/api/analytics/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}
