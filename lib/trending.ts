import { adminFirestore } from '@/lib/firebase-admin';
import { getArtwork } from '@/lib/get-artwork';
import { getPreviewUrl } from '@/lib/get-preview-url';

export type TrendingWindow = '1h' | '24h' | '7d' | '30d';
export type TrendingSong = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  artistSlug?: string;
  artwork?: string;
  previewUrl?: string;
  duration?: number;
  score: number;
  rank: number;
  signals: Record<string, number>;
};

const WINDOW_MS: Record<TrendingWindow, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const WEIGHTS: Record<string, number> = {
  song_play: 1,
  preview_complete: 2,
  song_complete: 4,
  playlist_song_added: 5,
  song_shared: 6,
  referral_shared: 4,
  song_like: 4,
  song_download: 7,
  song_purchase: 8,
};

function eventDate(event: Record<string, any>) {
  const value = event.createdAt?.toDate?.() || event.receivedAt || event.createdAt;
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function songIdFromEvent(event: Record<string, any>) {
  if (event.entityType === 'song' && event.entityId) return String(event.entityId);
  return String(event.metadata?.songId || event.songId || '');
}

function text(value: unknown, fallback = '') { return String(value || fallback).trim(); }
function number(value: unknown) { const result = Number(value || 0); return Number.isFinite(result) ? result : 0; }

export async function getTrendingSongs(window: TrendingWindow = '24h', limit = 20): Promise<TrendingSong[]> {
  const now = Date.now();
  const windowMs = WINDOW_MS[window];
  const cutoff = new Date(now - windowMs).toISOString();
  const snapshot = await adminFirestore.collection('analyticsEvents')
    .where('receivedAt', '>=', cutoff)
    .orderBy('receivedAt', 'desc')
    .limit(5000)
    .get();

  const scores = new Map<string, { score: number; signals: Record<string, number>; actors: Map<string, number> }>();
  for (const doc of snapshot.docs) {
    const event = doc.data() as Record<string, any>;
    const songId = songIdFromEvent(event);
    const weight = WEIGHTS[String(event.eventType || '')] || 0;
    const date = eventDate(event);
    if (!songId || !weight || !date) continue;
    const age = Math.max(0, now - date.getTime());
    const decay = Math.exp(-3 * age / windowMs);
    const actor = text(event.memberId || event.sessionId || event.userAgent, 'anonymous');
    const current = scores.get(songId) || { score: 0, signals: {}, actors: new Map<string, number>() };
    const eventType = String(event.eventType);
    current.signals[eventType] = (current.signals[eventType] || 0) + 1;
    current.score += weight * decay;
    if (eventType === 'song_play') {
      const prior = current.actors.get(actor) || 0;
      if (prior > 0) {
        current.score += 1.5 * decay;
        current.signals.repeat_listens = (current.signals.repeat_listens || 0) + 1;
      }
      current.actors.set(actor, prior + 1);
    }
    scores.set(songId, current);
  }

  if (!scores.size) return [];
  const ids = [...scores.keys()].slice(0, 500);
  const songDocs = await Promise.all(ids.map(id => adminFirestore.collection('songs').doc(id).get()));
  const ranked = songDocs.flatMap(doc => {
    if (!doc.exists) return [];
    const song = doc.data() as Record<string, any>;
    if (song.status && song.status !== 'published') return [];
    const scored = scores.get(doc.id);
    if (!scored) return [];
    const details = song.details && typeof song.details === 'object' ? song.details : {};
    return [{
      id: doc.id,
      slug: text(song.slug, doc.id),
      title: text(song.title, 'Untitled track'),
      artist: text(song.artistName || details.artistName || song.artist || details.artist, 'Aureon Music Group'),
      artistSlug: text(song.artistSlug || details.artistSlug),
      artwork: getArtwork(song),
      previewUrl: getPreviewUrl(song),
      duration: number(song.duration || details.duration || song.durationSeconds || details.durationSeconds),
      score: Number(scored.score.toFixed(4)),
      rank: 0,
      signals: scored.signals,
    }];
  }).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 100)));

  return ranked.map((song, index) => ({ ...song, rank: index + 1 }));
}
