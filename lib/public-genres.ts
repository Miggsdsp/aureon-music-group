import { getPublishedRecords } from '@/lib/seo';
import { cache } from 'react';

// Preserve existing core landing pages and the linked all-releases page.
const coreGenres = new Map([
  ['all', ''], ['country-pop', 'Country-Pop'], ['afrobeats', 'Afrobeats'],
  ['deep-house', 'Deep House'], ['latin-pop', 'Latin Pop'],
  ['reggae', 'Reggae'], ['modern-pop', 'Modern Pop'],
]);

export function genreSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const getPublicGenre = cache(async (slug: string): Promise<string | null> => {
  if (coreGenres.has(slug)) return coreGenres.get(slug)!;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  // Additional genres are allowlisted by real, currently public catalogue data.
  // Arbitrary URL text is never used to manufacture a genre page.
  const [songs, albums] = await Promise.all([getPublishedRecords('songs'), getPublishedRecords('albums')]);
  for (const record of [...songs, ...albums]) {
    const genre = record.genre || record.details?.genre || record.primaryGenre || record.details?.primaryGenre;
    if (typeof genre === 'string' && genre.trim() && genreSlug(genre) === slug) return genre.trim();
  }
  return null;
});
