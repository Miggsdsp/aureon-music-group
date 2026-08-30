import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export const ANALYTICS_EVENTS = [
  'song_play','song_pause','song_complete','preview_complete','song_cart_add','song_purchase','song_like','song_unlike','song_shared','song_download',
  'video_play','video_pause','video_complete','video_preview_complete','video_view',
  'membership_checkout_started','membership_started','membership_renewed','membership_cancelled','membership_payment_failed',
  'search_used','search_result_clicked',
  'playlist_created','playlist_renamed','playlist_deleted','playlist_song_added','playlist_song_removed','playlist_played',
  'artist_followed','artist_unfollowed','referral_shared','referral_signup','referral_converted',
  'recommendation_impression','recommendation_click','recommendation_play','recommendation_complete','recommendation_playlist_add','recommendation_conversion',
  'trust_impression','trust_click','trust_conversion',
  'merch_view','merch_cart_add','album_view','artist_view','web_vital','core_web_vital'
] as const;

export type AnalyticsEventType = typeof ANALYTICS_EVENTS[number];
export type ServerAnalyticsEvent = {
  eventType: AnalyticsEventType;
  entityType?: string; entityId?: string; title?: string;
  artistId?: string; artistName?: string; albumId?: string; albumTitle?: string;
  productId?: string; productName?: string; playlistId?: string; playlistName?: string;
  memberId?: string; referralCode?: string; searchQuery?: string; searchResultCount?: number;
  plan?: string; revenueCents?: number; currency?: string;
  durationSeconds?: number; listenedSeconds?: number; progressPercent?: number;
  visitorId?: string; sessionId?: string; country?: string; region?: string; city?: string;
  locale?: string; timezone?: string; deviceType?: string; pathname?: string; referrer?: string; userAgent?: string;
  metricName?: string; metricValue?: number; metricRating?: string; metricId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

const clean = (value: unknown, max = 180) => String(value || '').trim().slice(0, max);
const number = (value: unknown, max = Number.MAX_SAFE_INTEGER) => Math.max(0, Math.min(max, Number(value || 0) || 0));
const keyPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown';

export async function recordAnalyticsEvent(input: ServerAnalyticsEvent) {
  if (!ANALYTICS_EVENTS.includes(input.eventType)) throw new Error(`Unsupported analytics event: ${input.eventType}`);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const metadata = input.metadata || {};
  const event = {
    eventType: input.eventType,
    entityType: clean(input.entityType, 30), entityId: clean(input.entityId, 160), title: clean(input.title),
    artistId: clean(input.artistId, 160), artistName: clean(input.artistName), albumId: clean(input.albumId, 160), albumTitle: clean(input.albumTitle),
    productId: clean(input.productId, 160), productName: clean(input.productName), playlistId: clean(input.playlistId, 160), playlistName: clean(input.playlistName),
    memberId: clean(input.memberId, 160), referralCode: clean(input.referralCode, 80), searchQuery: clean(input.searchQuery, 240), searchResultCount: number(input.searchResultCount, 100000),
    plan: clean(input.plan, 40), revenueCents: number(input.revenueCents), currency: clean(input.currency || 'eur', 12).toLowerCase(),
    durationSeconds: number(input.durationSeconds, 86400), listenedSeconds: number(input.listenedSeconds, 86400), progressPercent: number(input.progressPercent, 100),
    visitorId: clean(input.visitorId, 120), sessionId: clean(input.sessionId, 120), country: clean(input.country || 'Unknown', 8), region: clean(input.region || 'Unknown', 80), city: clean(input.city || 'Unknown', 100),
    locale: clean(input.locale, 40), timezone: clean(input.timezone, 80), deviceType: clean(input.deviceType, 30), pathname: clean(input.pathname, 300), referrer: clean(input.referrer, 500), userAgent: clean(input.userAgent, 500),
    metricName: clean(input.metricName, 30), metricValue: number(input.metricValue, 1000000), metricRating: clean(input.metricRating, 30), metricId: clean(input.metricId, 120),
    metadata, createdAt: FieldValue.serverTimestamp(), receivedAt: now.toISOString(), day
  };
  const eventRef = adminFirestore.collection('analyticsEvents').doc();
  const dayRef = adminFirestore.collection('analyticsDaily').doc(day);
  const totalRef = adminFirestore.collection('analyticsTotals').doc('platform');
  const eventKey = keyPart(input.eventType);
  const increments: Record<string, any> = { [`events.${eventKey}`]: FieldValue.increment(1), totalEvents: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() };
  if (event.revenueCents) increments.revenueCents = FieldValue.increment(event.revenueCents);
  if (event.listenedSeconds) increments.listenedSeconds = FieldValue.increment(event.listenedSeconds);
  if (event.country && event.country !== 'Unknown') increments[`countries.${keyPart(event.country)}`] = FieldValue.increment(1);
  if (event.entityType) increments[`entityTypes.${keyPart(event.entityType)}`] = FieldValue.increment(1);
  if (input.eventType.startsWith('recommendation_')) {
    const action = input.eventType.replace('recommendation_', '');
    const source = keyPart(clean(metadata.recommendationSource || 'unknown', 100));
    const algorithm = keyPart(clean(metadata.recommendationAlgorithm || 'unknown', 100));
    increments[`discovery.actions.${keyPart(action)}`] = FieldValue.increment(1);
    increments[`discovery.sources.${source}.${keyPart(action)}`] = FieldValue.increment(1);
    increments[`discovery.algorithms.${algorithm}.${keyPart(action)}`] = FieldValue.increment(1);
    if (metadata.recommendationPosition !== undefined) {
      const position = Math.max(1, Math.min(100, Number(metadata.recommendationPosition) || 1));
      increments[`discovery.positions.${position}.${keyPart(action)}`] = FieldValue.increment(1);
    }
  }
  if (input.eventType.startsWith('trust_')) {
    const action = keyPart(input.eventType.replace('trust_', ''));
    const placement = keyPart(clean(metadata.trustPlacement || input.entityId || 'unknown', 100));
    const category = keyPart(clean(metadata.trustCategory || input.entityType || 'general', 100));
    increments[`trust.actions.${action}`] = FieldValue.increment(1);
    increments[`trust.placements.${placement}.${action}`] = FieldValue.increment(1);
    increments[`trust.categories.${category}.${action}`] = FieldValue.increment(1);
    if (metadata.conversionType) increments[`trust.conversions.${keyPart(clean(metadata.conversionType, 100))}`] = FieldValue.increment(1);
  }
  const batch = adminFirestore.batch();
  batch.set(eventRef, event);
  batch.set(dayRef, { day, ...increments, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(totalRef, increments, { merge: true });
  await batch.commit();
  return eventRef.id;
}
