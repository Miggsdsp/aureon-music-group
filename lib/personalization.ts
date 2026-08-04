import { recommendSongs, type ListeningSignal, type PlaylistSignal, type RecommendationEntity, type RecommendationResult } from '@/lib/recommendations';

export type PersonalisationProfile = {
  listeningHistory: ListeningSignal[];
  favouriteSongIds: string[];
  followedArtistIds: string[];
  favouriteGenres: string[];
  playlists: PlaylistSignal[];
};

export type ListeningMoment = {
  key: 'morning' | 'daytime' | 'evening' | 'late-night';
  title: string;
  description: string;
  moods: string[];
  energyTarget: number;
};

const normalise = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const list = (value: unknown): string[] => Array.isArray(value)
  ? value.flatMap((item): string[] => list(item))
  : String(value || '').split(/[,/|;]+/).map(normalise).filter(Boolean);

function field(item: RecommendationEntity, keys: string[]) {
  const details = item.details && typeof item.details === 'object' ? item.details : {};
  for (const key of keys) {
    const root = item[key];
    if (root !== undefined && root !== null && root !== '') return root;
    const nested = details[key];
    if (nested !== undefined && nested !== null && nested !== '') return nested;
  }
  return undefined;
}

function energy(item: RecommendationEntity) {
  const raw = field(item, ['energy', 'energyLevel', 'intensity']);
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric > 1 ? Math.min(1, numeric / 100) : Math.max(0, numeric);
  const label = normalise(raw);
  if (['high', 'energetic', 'intense', 'powerful'].includes(label)) return .85;
  if (['low', 'calm', 'soft', 'relaxed'].includes(label)) return .25;
  return .55;
}

export function listeningMoment(now = new Date()): ListeningMoment {
  const hour = now.getHours();
  if (hour < 6 || hour >= 22) return { key: 'late-night', title: 'Made for your night', description: 'A deeper, calmer selection shaped by your listening habits.', moods: ['late night', 'calm', 'reflective', 'deep', 'chill'], energyTarget: .35 };
  if (hour < 11) return { key: 'morning', title: 'Your morning soundtrack', description: 'Fresh music selected to begin the day with focus and momentum.', moods: ['uplifting', 'focus', 'acoustic', 'positive', 'morning'], energyTarget: .55 };
  if (hour < 18) return { key: 'daytime', title: 'Picked for you right now', description: 'Personal recommendations balanced for your current listening moment.', moods: ['energetic', 'positive', 'driving', 'focus'], energyTarget: .7 };
  return { key: 'evening', title: 'Your evening selection', description: 'Familiar favourites and new discoveries chosen for the end of the day.', moods: ['relaxed', 'soulful', 'romantic', 'warm', 'evening'], energyTarget: .45 };
}

export function personalisedSongs<T extends RecommendationEntity>(
  songs: T[],
  profile: PersonalisationProfile,
  now = new Date(),
  limit = 10,
): Array<RecommendationResult<T> & { personalReason: string }> {
  const moment = listeningMoment(now);
  const genreHistory: ListeningSignal[] = profile.favouriteGenres.map(genre => ({ entityType: 'song', genre, playCount: 3, completed: true }));
  const base = recommendSongs(songs, {
    listeningHistory: [...profile.listeningHistory, ...genreHistory],
    favouriteIds: profile.favouriteSongIds,
    followedArtistIds: profile.followedArtistIds,
    playlists: profile.playlists,
    now,
    limit: Math.max(limit * 3, 24),
  });
  const momentMoods = new Set(moment.moods.map(normalise));
  const followed = new Set(profile.followedArtistIds.map(normalise));
  const favourites = new Set(profile.favouriteSongIds.map(normalise));
  const favouriteGenres = new Set(profile.favouriteGenres.map(normalise));

  return base.map(result => {
    const item = result.item;
    const moods = list(field(item, ['mood', 'moods', 'vibe', 'vibes']));
    const genres = list(field(item, ['genre', 'genres', 'primaryGenre']));
    const artistId = normalise(field(item, ['artistId', 'artistSlug', 'artistName', 'artist']));
    const id = normalise(item.id || item.slug || item.title || item.name);
    const moodMatch = moods.some(mood => momentMoods.has(mood)) ? 8 : 0;
    const energyMatch = Math.max(0, 1 - Math.abs(energy(item) - moment.energyTarget)) * 6;
    const genreMatch = genres.some(genre => favouriteGenres.has(genre)) ? 9 : 0;
    const artistMatch = followed.has(artistId) ? 10 : 0;
    const favouriteMatch = favourites.has(id) ? 5 : 0;
    const score = result.score + moodMatch + energyMatch + genreMatch + artistMatch + favouriteMatch;
    let personalReason = `Selected for your ${moment.key.replace('-', ' ')}`;
    if (artistMatch) personalReason = 'Because you follow this artist';
    else if (genreMatch) personalReason = 'Matches one of your favourite genres';
    else if (result.reasons.some(reason => reason.signal === 'history')) personalReason = 'Based on your listening history';
    else if (result.reasons.some(reason => reason.signal === 'favourites')) personalReason = 'Inspired by songs you love';
    else if (moodMatch) personalReason = `Fits your ${moment.key.replace('-', ' ')} mood`;
    return { ...result, score: Number(score.toFixed(3)), personalReason };
  }).sort((a, b) => b.score - a.score || b.confidence - a.confidence).slice(0, limit);
}
