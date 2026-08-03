import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, safeJsonLd, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const album = await getPublishedRecord('albums', slug);
  if (!album) return { title: 'Album not found', robots: { index: false, follow: false } };
  const title = text(album.title || album.name, 'Aureon Album');
  const artist = text(album.artistName || album.artist, 'Aureon Music Group');
  const description = text(album.seoDescription || album.description, `Listen to ${title} by ${artist}. Discover the album, songs and artist on Aureon Music Group.`).slice(0, 160);
  return buildMetadata({ title: `${title} by ${artist}`, description, path: `/music/${album.slug || slug}`, image: album.coverImageUrl || album.coverUrl || album.imageUrl });
}

export default async function AlbumLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const album = await getPublishedRecord('albums', slug);
  if (!album) return children;
  const title = text(album.title || album.name, 'Aureon Album');
  const artist = text(album.artistName || album.artist, 'Aureon Music Group');
  const path = `/music/${album.slug || slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    '@id': `${SITE_URL}${path}#album`,
    name: title,
    url: `${SITE_URL}${path}`,
    image: album.coverImageUrl || album.coverUrl || album.imageUrl,
    description: text(album.description),
    genre: album.genre,
    datePublished: album.releaseDate || album.year,
    byArtist: { '@type': 'MusicGroup', name: artist },
    numTracks: album.trackCount || (Array.isArray(album.tracks) ? album.tracks.length : undefined),
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Music', path: '/music' }, { name: title, path }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
