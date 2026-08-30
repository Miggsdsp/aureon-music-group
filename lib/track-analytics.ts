'use client';

export type AnalyticsEventName =
  | 'song_play'|'song_pause'|'song_complete'|'preview_complete'|'song_cart_add'|'song_purchase'|'song_like'|'song_unlike'
  | 'video_play'|'video_pause'|'video_complete'|'video_preview_complete'|'video_view'
  | 'membership_checkout_started'|'membership_started'|'membership_renewed'|'membership_cancelled'|'membership_payment_failed'
  | 'search_used'|'search_result_clicked'
  | 'playlist_created'|'playlist_renamed'|'playlist_deleted'|'playlist_song_added'|'playlist_song_removed'|'playlist_played'
  | 'artist_followed'|'artist_unfollowed'|'referral_shared'|'referral_signup'|'referral_converted'
  | 'recommendation_impression'|'recommendation_click'|'recommendation_play'|'recommendation_complete'|'recommendation_playlist_add'|'recommendation_conversion'
  | 'trust_impression'|'trust_click'|'trust_conversion'
  | 'merch_view'|'merch_cart_add'|'album_view'|'artist_view'|'web_vital'|'core_web_vital';

export type AnalyticsEvent = {
  eventType: AnalyticsEventName;
  entityType?: string; entityId?: string; title?: string;
  artistId?: string; artistName?: string; albumId?: string; albumTitle?: string;
  productId?: string; productName?: string; playlistId?: string; playlistName?: string;
  durationSeconds?: number; listenedSeconds?: number; progressPercent?: number;
  memberId?: string; referralCode?: string; searchQuery?: string; searchResultCount?: number;
  plan?: string; revenueCents?: number; currency?: string;
  metricName?: string; metricValue?: number; metricRating?: string; metricId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

function visitorId() {
  const key = 'aureon-analytics-visitor';
  let value = localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
  return value;
}
function sessionId() {
  const key = 'aureon-analytics-session';
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
  return value;
}
function deviceType() { const width = window.innerWidth; return width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop'; }

export function trackAnalytics(event: AnalyticsEvent) {
  if (typeof window === 'undefined') return;
  const payload = { ...event, visitorId: visitorId(), sessionId: sessionId(), locale: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, deviceType: deviceType(), pathname: window.location.pathname, referrer: document.referrer };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) { navigator.sendBeacon('/api/analytics/track', new Blob([body], { type: 'application/json' })); return; }
  fetch('/api/analytics/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
}
