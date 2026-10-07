import { cache } from 'react';

export type PublicGenre = {
  slug: string;
  label: string;
  description: string;
  aliases: string[];
};

export const publicGenres: PublicGenre[] = [
  {
    slug: 'all',
    label: '',
    description: 'All published Aureon releases across artists and styles.',
    aliases: [],
  },
  {
    slug: 'country-pop',
    label: 'Country-Pop',
    description: 'Country-pop and modern Nashville-influenced songs from the Aureon catalogue.',
    aliases: ['modern-country-pop', 'country', 'country-rock'],
  },
  {
    slug: 'afrobeats',
    label: 'Afrobeats',
    description: 'Afrobeats and Afro-pop releases from Aureon artists.',
    aliases: ['afro-beats', 'afrobeat', 'afro-beat'],
  },
  {
    slug: 'deep-house',
    label: 'Deep House',
    description: 'Deep house, dance and electronic releases from the Aureon catalogue.',
    aliases: ['dance', 'dance-pop', 'melodic-house'],
  },
  {
    slug: 'latin-pop',
    label: 'Latin Pop',
    description: 'Latin pop and Portuguese-influenced releases from Aureon artists.',
    aliases: ['latin', 'latin-pop-dance-pop-smooth-r-b-melodic-house-and-portuguese-influences'],
  },
  {
    slug: 'reggae',
    label: 'Reggae',
    description: 'Reggae, roots, lovers rock and island-influenced Aureon releases.',
    aliases: ['modern-reggae-fusion', 'roots-reggae'],
  },
  {
    slug: 'modern-pop',
    label: 'Modern Pop',
    description: 'Modern pop releases from the Aureon catalogue.',
    aliases: ['pop'],
  },
];

const genreMap = new Map(publicGenres.map(genre => [genre.slug, genre]));
const aliasMap = new Map<string, string>();
for (const genre of publicGenres) {
  for (const alias of genre.aliases) aliasMap.set(alias, genre.slug);
}

export function genreSlug(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function canonicalGenreSlug(slug: string): string | null {
  const clean = genreSlug(slug);
  if (genreMap.has(clean)) return clean;
  return aliasMap.get(clean) || null;
}

export function genreRedirectTarget(slug: string): string | null {
  const clean = genreSlug(slug);
  const canonical = canonicalGenreSlug(clean);
  return canonical && canonical !== clean ? canonical : null;
}

export function getControlledGenres() {
  return publicGenres.filter(genre => genre.slug !== 'all');
}

export const getPublicGenre = cache(async (slug: string): Promise<string | null> => {
  const canonical = canonicalGenreSlug(slug);
  if (!canonical) return null;
  return genreMap.get(canonical)?.label ?? null;
});
