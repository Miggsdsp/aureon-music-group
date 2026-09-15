export const CLIENT_ANALYTICS_EVENTS = [
  'page_view','artist_view','song_view','album_view','discover_view',
  'music_preview_start','music_preview_progress','music_preview_complete',
  'registration_start','login','membership_view','artist_follow','song_favourite','playlist_add','search','returning_listener',
  'song_pause','song_complete','song_cart_add','song_like','song_unlike',
  'video_play','video_pause','video_complete','video_preview_complete','video_view',
  'search_result_clicked','playlist_created','playlist_renamed','playlist_deleted','playlist_song_added','playlist_song_removed','playlist_played',
  'artist_followed','artist_unfollowed','referral_shared',
  'recommendation_impression','recommendation_click','recommendation_play','recommendation_complete','recommendation_playlist_add',
  'trust_impression','trust_click','merch_view','merch_cart_add','web_vital','core_web_vital',
] as const;

export const TRUSTED_ANALYTICS_EVENTS = [
  'registration_complete','subscription_checkout_start','subscription_complete','purchase_checkout_start','purchase_complete',
  'membership_started','membership_renewed','membership_cancelled','membership_payment_failed',
  'song_purchase','song_download','referral_signup','referral_converted',
] as const;

export const ANALYTICS_EVENTS = [...CLIENT_ANALYTICS_EVENTS, ...TRUSTED_ANALYTICS_EVENTS] as const;
export type ClientAnalyticsEventName = typeof CLIENT_ANALYTICS_EVENTS[number];
export type TrustedAnalyticsEventName = typeof TRUSTED_ANALYTICS_EVENTS[number];
export type AnalyticsEventName = typeof ANALYTICS_EVENTS[number];

export type AttributionTouch = { source:string; medium:string; campaign:string; content:string; term:string; referrer:string; landingPage:string };
export type ContentAttribution = { firstSongViewed?:string; lastSongViewed?:string; firstArtistViewed?:string; lastArtistViewed?:string };
export type AnalyticsContext = { consent:boolean; visitorId:string; sessionId:string; firstTouch:AttributionTouch; sessionTouch:AttributionTouch; content:ContentAttribution };
