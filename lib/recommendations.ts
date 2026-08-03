export type RecommendationEntity = Record<string, unknown> & {
  id?: string;
  title?: string;
  name?: string;
  slug?: string;
  status?: string;
  details?: Record<string, unknown>;
};

export type ListeningSignal = {
  entityId?: string;
  entityType?: 'song' | 'artist' | 'album' | 'playlist';
  artistId?: string;
  genre?: string;
  subgenre?: string;
  mood?: string;
  playedAt?: Date | string | number;
  playCount?: number;
  completed?: boolean;
  progressPercent?: number;
};

export type PlaylistSignal = {
  id?: string;
  name?: string;
  songIds?: string[];
  genres?: string[];
  moods?: string[];
};

export type RecommendationContext = {
  seed?: RecommendationEntity | null;
  listeningHistory?: ListeningSignal[];
  playlists?: PlaylistSignal[];
  favouriteIds?: string[];
  followedArtistIds?: string[];
  now?: Date;
  limit?: number;
  excludeIds?: string[];
};

export type RecommendationReason = {
  signal: string;
  contribution: number;
};

export type RecommendationResult<T extends RecommendationEntity> = {
  item: T;
  score: number;
  confidence: number;
  reasons: RecommendationReason[];
};

type Profile = {
  id: string;
  artistId: string;
  genres: Set<string>;
  subgenres: Set<string>;
  moods: Set<string>;
  bpm: number | null;
  energy: number | null;
  releaseDate: Date | null;
  popularity: number;
  recentPlays: number;
  songIds: Set<string>;
};

const DEFAULT_LIMIT = 8;
const DAY_MS = 86_400_000;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const asString = (value: unknown) => String(value ?? '').trim();
const normalise = (value: unknown) => asString(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function first(entity: RecommendationEntity, keys: string[]) {
  const details = asObject(entity.details);
  for (const key of keys) {
    const root = entity[key];
    if (root !== undefined && root !== null && root !== '') return root;
    const nested = details[key];
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }
  return undefined;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(asString(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(listValue).filter(Boolean);
  const text = asString(value);
  if (!text) return [];
  return text.split(/[,/|;]+/).map(normalise).filter(Boolean);
}

function dateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const timestampLike = value as { toDate?: () => Date; seconds?: number };
  if (typeof timestampLike?.toDate === 'function') return timestampLike.toDate();
  if (typeof timestampLike?.seconds === 'number') return new Date(timestampLike.seconds * 1000);
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
}

function setOf(values: string[]) {
  return new Set(values.map(normalise).filter(Boolean));
}

function entityId(entity: RecommendationEntity) {
  return asString(entity.id || entity.slug || first(entity, ['artistId', 'albumId', 'playlistId']) || entity.title || entity.name);
}

function buildProfile(entity: RecommendationEntity): Profile {
  const songIds = listValue(first(entity, ['songIds', 'trackIds', 'songs', 'tracks']));
  const popularity = numberValue(first(entity, ['popularity', 'popularityScore', 'playCount', 'plays', 'totalPlays', 'monthlyPlays'])) || 0;
  const recentPlays = numberValue(first(entity, ['recentPlays', 'plays7d', 'plays30d', 'weeklyPlays'])) || 0;
  return {
    id: entityId(entity),
    artistId: asString(first(entity, ['artistId', 'artistSlug', 'artistCode', 'artistName', 'artist'])),
    genres: setOf(listValue(first(entity, ['genre', 'genres', 'primaryGenre']))),
    subgenres: setOf(listValue(first(entity, ['subgenre', 'subgenres', 'style', 'styles', 'sound']))),
    moods: setOf(listValue(first(entity, ['mood', 'moods', 'vibe', 'vibes']))),
    bpm: numberValue(first(entity, ['bpm', 'tempo'])),
    energy: normaliseEnergy(first(entity, ['energy', 'energyLevel', 'intensity'])),
    releaseDate: dateValue(first(entity, ['releaseDate', 'publishedAt', 'publishDate', 'createdAt', 'year'])),
    popularity,
    recentPlays,
    songIds: new Set(songIds),
  };
}

function normaliseEnergy(value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric !== null) return numeric > 1 ? Math.min(1, numeric / 100) : Math.max(0, numeric);
  const label = normalise(value);
  if (!label) return null;
  if (['low', 'calm', 'soft'].includes(label)) return 0.25;
  if (['medium', 'balanced', 'moderate'].includes(label)) return 0.55;
  if (['high', 'energetic', 'intense'].includes(label)) return 0.85;
  return null;
}

function overlap(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let matches = 0;
  for (const value of a) if (b.has(value)) matches += 1;
  return matches / Math.max(a.size, b.size);
}

function proximity(a: number | null, b: number | null, range: number) {
  if (a === null || b === null) return 0;
  return Math.max(0, 1 - Math.abs(a - b) / range);
}

function recency(date: Date | null, now: Date) {
  if (!date) return 0;
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / DAY_MS);
  return Math.exp(-ageDays / 365);
}

function scaledPopularity(value: number) {
  return value <= 0 ? 0 : Math.min(1, Math.log10(value + 1) / 6);
}

function historyPreferences(history: ListeningSignal[]) {
  const genres = new Map<string, number>();
  const subgenres = new Map<string, number>();
  const moods = new Map<string, number>();
  const artists = new Map<string, number>();
  const entities = new Map<string, number>();
  const add = (map: Map<string, number>, key: unknown, weight: number) => {
    const value = normalise(key);
    if (value) map.set(value, (map.get(value) || 0) + weight);
  };
  for (const item of history) {
    const completionWeight = item.completed ? 1.5 : Math.max(0.25, Number(item.progressPercent || 0) / 100);
    const repeatWeight = Math.min(3, Math.max(1, Number(item.playCount || 1)));
    const weight = completionWeight * repeatWeight;
    add(genres, item.genre, weight);
    add(subgenres, item.subgenre, weight);
    add(moods, item.mood, weight);
    add(artists, item.artistId, weight);
    add(entities, item.entityId, weight);
  }
  const max = (map: Map<string, number>) => Math.max(1, ...map.values());
  return { genres, subgenres, moods, artists, entities, maxima: { genres: max(genres), subgenres: max(subgenres), moods: max(moods), artists: max(artists), entities: max(entities) } };
}

function preferenceScore(values: Set<string>, map: Map<string, number>, maximum: number) {
  let score = 0;
  for (const value of values) score = Math.max(score, (map.get(value) || 0) / maximum);
  return score;
}

function playlistAffinity(profile: Profile, playlists: PlaylistSignal[]) {
  if (!playlists.length) return 0;
  let score = 0;
  for (const playlist of playlists) {
    const songMatch = [...profile.songIds].some(id => playlist.songIds?.includes(id));
    const genreMatch = overlap(profile.genres, setOf(playlist.genres || []));
    const moodMatch = overlap(profile.moods, setOf(playlist.moods || []));
    score = Math.max(score, songMatch ? 1 : Math.max(genreMatch, moodMatch));
  }
  return score;
}

function scoreEntity<T extends RecommendationEntity>(
  item: T,
  context: RecommendationContext,
  weights: Record<string, number>,
): RecommendationResult<T> {
  const profile = buildProfile(item);
  const seed = context.seed ? buildProfile(context.seed) : null;
  const history = historyPreferences(context.listeningHistory || []);
  const favourites = new Set((context.favouriteIds || []).map(normalise));
  const followed = new Set((context.followedArtistIds || []).map(normalise));
  const now = context.now || new Date();
  const signals: Array<[string, number]> = [
    ['genre', seed ? overlap(profile.genres, seed.genres) : preferenceScore(profile.genres, history.genres, history.maxima.genres)],
    ['subgenre', seed ? overlap(profile.subgenres, seed.subgenres) : preferenceScore(profile.subgenres, history.subgenres, history.maxima.subgenres)],
    ['mood', seed ? overlap(profile.moods, seed.moods) : preferenceScore(profile.moods, history.moods, history.maxima.moods)],
    ['bpm', seed ? proximity(profile.bpm, seed.bpm, 70) : 0],
    ['energy', seed ? proximity(profile.energy, seed.energy, 1) : 0],
    ['artist', seed && profile.artistId && normalise(profile.artistId) === normalise(seed.artistId) ? 1 : (history.artists.get(normalise(profile.artistId)) || 0) / history.maxima.artists],
    ['release', recency(profile.releaseDate, now)],
    ['popularity', scaledPopularity(profile.popularity)],
    ['recentPlays', scaledPopularity(profile.recentPlays)],
    ['history', (history.entities.get(normalise(profile.id)) || 0) / history.maxima.entities],
    ['playlists', playlistAffinity(profile, context.playlists || [])],
    ['favourites', favourites.has(normalise(profile.id)) ? 1 : 0],
    ['followedArtist', followed.has(normalise(profile.artistId)) ? 1 : 0],
  ];

  const reasons: RecommendationReason[] = [];
  let score = 0;
  let availableWeight = 0;
  for (const [signal, raw] of signals) {
    const weight = weights[signal] || 0;
    if (!weight || raw <= 0) continue;
    const contribution = raw * weight;
    score += contribution;
    availableWeight += weight;
    reasons.push({ signal, contribution: Number(contribution.toFixed(3)) });
  }
  const normalisedScore = availableWeight ? score / availableWeight : 0;
  const evidence = Math.min(1, reasons.length / 6);
  const confidence = Math.min(1, normalisedScore * 0.8 + evidence * 0.2);
  return {
    item,
    score: Number(score.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    reasons: reasons.sort((a, b) => b.contribution - a.contribution).slice(0, 5),
  };
}

function recommend<T extends RecommendationEntity>(items: T[], context: RecommendationContext, weights: Record<string, number>) {
  const excluded = new Set([...(context.excludeIds || []), context.seed ? entityId(context.seed) : ''].map(normalise).filter(Boolean));
  const published = items.filter(item => !item.status || item.status === 'published' || item.status === 'active');
  return published
    .filter(item => !excluded.has(normalise(entityId(item))))
    .map(item => scoreEntity(item, context, weights))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, context.limit || DEFAULT_LIMIT);
}

const SONG_WEIGHTS = { genre: 18, subgenre: 12, mood: 14, bpm: 8, energy: 8, artist: 8, release: 6, popularity: 7, recentPlays: 8, history: 5, playlists: 8, favourites: 4, followedArtist: 5 };
const ARTIST_WEIGHTS = { genre: 22, subgenre: 18, mood: 10, artist: 4, release: 4, popularity: 10, recentPlays: 10, history: 8, playlists: 5, favourites: 3, followedArtist: 6 };
const ALBUM_WEIGHTS = { genre: 20, subgenre: 14, mood: 14, bpm: 5, energy: 6, artist: 8, release: 10, popularity: 8, recentPlays: 8, history: 4, playlists: 7, favourites: 3, followedArtist: 5 };
const PLAYLIST_WEIGHTS = { genre: 20, subgenre: 10, mood: 20, energy: 8, release: 4, popularity: 8, recentPlays: 8, history: 5, playlists: 10, favourites: 3, followedArtist: 4 };

export function recommendSongs<T extends RecommendationEntity>(songs: T[], context: RecommendationContext = {}) {
  return recommend(songs, context, SONG_WEIGHTS);
}

export function recommendArtists<T extends RecommendationEntity>(artists: T[], context: RecommendationContext = {}) {
  return recommend(artists, context, ARTIST_WEIGHTS);
}

export function recommendAlbums<T extends RecommendationEntity>(albums: T[], context: RecommendationContext = {}) {
  return recommend(albums, context, ALBUM_WEIGHTS);
}

export function recommendPlaylists<T extends RecommendationEntity>(playlists: T[], context: RecommendationContext = {}) {
  return recommend(playlists, context, PLAYLIST_WEIGHTS);
}
