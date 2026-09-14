export type ArtistIdentity = {
  name: string;
  slug: string;
  aliases?: string[];
  seoDescription: string;
};

const ARTIST_IDENTITIES: ArtistIdentity[] = [
  {
    name: 'Dalton Creed',
    slug: 'dalton-creed',
    seoDescription: 'Dalton Creed blends country storytelling with modern country rock and country-pop production. Explore Dust On My Boots and his Aureon releases.',
  },
  {
    name: 'Thiago Navar',
    slug: 'thiago-navar',
    seoDescription: 'Thiago Navar brings Latin Pop and Portuguese-influenced songwriting to Aureon. Explore Fire Under the Moon and his latest releases.',
  },
  {
    name: 'The 5th Current',
    slug: 'the-5th-current',
    seoDescription: 'The 5th Current creates cinematic Deep House and dance music for Aureon. Explore Love for the Beat and the latest releases.',
  },
  {
    name: 'Kiano Zuri',
    slug: 'kiano-zuri',
    aliases: ['kiano-zanu'],
    seoDescription: 'Kiano Zuri blends Afrobeats with polished global pop production. Explore Forever Starts Tonight and his latest Aureon releases.',
  },
  {
    name: 'Josiah Rivers',
    slug: 'josiah-rivers',
    seoDescription: 'Josiah Rivers combines modern reggae fusion with warm island rhythms and contemporary production. Explore Island in My Blood on Aureon.',
  },
  {
    name: 'Kealan Varek',
    slug: 'kealan-varek',
    aliases: ['kealan-verlek'],
    seoDescription: 'Kealan Varek delivers modern pop with emotional songwriting and polished electronic production. Explore Electric Heart and his Aureon releases.',
  },
];

const bySlug = new Map<string, ArtistIdentity>();
const byName = new Map<string, ArtistIdentity>();
for (const identity of ARTIST_IDENTITIES) {
  bySlug.set(identity.slug, identity);
  for (const alias of identity.aliases || []) bySlug.set(alias, identity);
  byName.set(identity.name.toLowerCase(), identity);
}
// Confirmed legacy public spelling for Kealan Varek.
byName.set('kealan verlek', bySlug.get('kealan-varek')!);

export function artistIdentityBySlug(value?: unknown): ArtistIdentity | undefined {
  const slug = String(value || '').trim().toLowerCase();
  return slug ? bySlug.get(slug) : undefined;
}

export function artistIdentityByName(value?: unknown): ArtistIdentity | undefined {
  const name = String(value || '').trim().toLowerCase();
  return name ? byName.get(name) : undefined;
}

export function canonicalArtistSlug(value?: unknown): string {
  const raw = String(value || '').trim();
  return artistIdentityBySlug(raw)?.slug || raw;
}

export function canonicalArtistName(value?: unknown): string {
  const raw = String(value || '').trim();
  return artistIdentityByName(raw)?.name || raw;
}

export function artistLookupSlugs(value: string): string[] {
  const raw = String(value || '').trim();
  const identity = artistIdentityBySlug(raw);
  if (!identity) return raw ? [raw] : [];
  return Array.from(new Set([raw, identity.slug, ...(identity.aliases || [])]));
}

export function canonicalArtistIdentity(record: Record<string, any>): ArtistIdentity | undefined {
  const details = record?.details || {};
  return (
    artistIdentityBySlug(record?.artistSlug) ||
    artistIdentityBySlug(details?.artistSlug) ||
    artistIdentityBySlug(record?.slug) ||
    artistIdentityByName(record?.artistName) ||
    artistIdentityByName(details?.artistName) ||
    artistIdentityByName(record?.artist) ||
    artistIdentityByName(record?.name) ||
    artistIdentityByName(record?.title)
  );
}

export function artistSeoDescription(record: Record<string, any>, fallback: string): string {
  const identity = canonicalArtistIdentity(record);
  return String(record?.seoDescription || identity?.seoDescription || record?.bio || record?.description || fallback)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}
