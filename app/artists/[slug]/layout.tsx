import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, safeJsonLd, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getPublishedRecord('artists', slug);
  if (!artist) return { title: 'Artist not found', robots: { index: false, follow: false } };
  const name = text(artist.name || artist.title, 'Aureon Artist');
  const description = text(artist.seoDescription || artist.bio || artist.description, `Discover ${name}, official music, albums and videos from Aureon Music Group.`).slice(0, 160);
  return buildMetadata({ title: `${name} | Official Artist`, description, path: `/artists/${artist.slug || slug}`, image: artist.profileImageUrl || artist.logoUrl || artist.image });
}

export default async function ArtistLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = await getPublishedRecord('artists', slug);
  if (!artist) return children;
  const name = text(artist.name || artist.title, 'Aureon Artist');
  const path = `/artists/${artist.slug || slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': artist.artistType === 'person' ? 'Person' : 'MusicGroup',
    '@id': `${SITE_URL}${path}#artist`,
    name,
    url: `${SITE_URL}${path}`,
    image: artist.profileImageUrl || artist.logoUrl || artist.image,
    description: text(artist.bio || artist.description),
    genre: artist.genre || artist.genres || artist.sound,
    sameAs: [artist.spotifyUrl, artist.appleMusicUrl, artist.youtubeUrl, artist.instagramUrl, artist.tiktokUrl].filter(Boolean),
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Artists', path: '/artists' }, { name, path }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
