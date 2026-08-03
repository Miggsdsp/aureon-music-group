import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, safeJsonLd, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const song = await getPublishedRecord('songs', slug);
  if (!song) return { title: 'Song not found', robots: { index: false, follow: false } };
  const details = song.details || {};
  const title = text(song.title || song.name, 'Aureon song');
  const artist = text(song.artistName || details.artistName || song.artist, 'Aureon Music Group');
  const description = text(song.seoDescription || song.description || details.description || details.story, `Listen to ${title} by ${artist} and discover similar music on Aureon Music Group.`).slice(0, 160);
  return buildMetadata({
    title: `${title} by ${artist}`,
    description,
    path: `/songs/${song.slug || slug}`,
    image: song.coverImageUrl || details.coverImageUrl || song.imageUrl,
    type: 'website',
  });
}

export default async function SongLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const song = await getPublishedRecord('songs', slug);
  if (!song) return children;
  const details = song.details || {};
  const title = text(song.title || song.name, 'Aureon song');
  const artist = text(song.artistName || details.artistName || song.artist, 'Aureon Music Group');
  const path = `/songs/${song.slug || slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${SITE_URL}${path}#recording`,
    name: title,
    url: `${SITE_URL}${path}`,
    image: song.coverImageUrl || details.coverImageUrl || song.imageUrl,
    description: text(song.description || details.description || details.story),
    genre: song.genre || details.genre,
    duration: song.duration || details.duration,
    datePublished: song.releaseDate || details.releaseDate,
    byArtist: { '@type': 'MusicGroup', name: artist },
    inAlbum: song.albumTitle || details.albumTitle ? { '@type': 'MusicAlbum', name: song.albumTitle || details.albumTitle } : undefined,
    audio: song.previewUrl || details.previewUrl ? { '@type': 'AudioObject', contentUrl: song.previewUrl || details.previewUrl } : undefined,
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Music', path: '/music' }, { name: title, path }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
