import { matchesAlbum, publicAsset } from '@/lib/public-catalogue';
import { getPreviewUrl } from '@/lib/get-preview-url';
import { canonicalArtistIdentity } from '@/lib/artist-identity';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, getPublishedRecords, safeJsonLd, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const song = await getPublishedRecord('songs', slug);
  if (!song) notFound();
  const details = song.details || {};
  const identity = canonicalArtistIdentity(song);
  const title = text(song.title || song.name, 'Aureon song');
  const artist = identity?.name || text(song.artistName || details.artistName || song.artist, 'Aureon Music Group');
  const description = text(song.seoDescription || song.description || details.description || song.story || details.story, `Listen to ${title} by ${artist} and discover similar music on Aureon Music Group.`).slice(0, 160);
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
  if (!song) notFound();
  const canonicalSlug = song.slug || slug;
  if (song.slug && slug !== canonicalSlug) permanentRedirect(`/songs/${canonicalSlug}`);
  const details = song.details || {};
  const identity = canonicalArtistIdentity(song);
  const title = text(song.title || song.name, 'Aureon song');
  const artist = identity?.name || text(song.artistName || details.artistName || song.artist, 'Aureon Music Group');
  const path = `/songs/${canonicalSlug}`;
  const artistSlug = identity?.slug || song.artistSlug || details.artistSlug;
  const artistPath = artistSlug ? `/artists/${artistSlug}` : undefined;
  const albums = await getPublishedRecords('albums');
  const album = albums.find(candidate => matchesAlbum(song, candidate));
  const albumTitle = text(song.albumTitle || details.albumTitle || album?.title || album?.name);
  const albumPath = album?.slug ? `/music/${album.slug}` : undefined;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${SITE_URL}${path}#recording`,
    name: title,
    url: `${SITE_URL}${path}`,
    image: song.coverImageUrl || details.coverImageUrl || song.imageUrl,
    description: text(song.description || details.description || song.story || details.story),
    genre: song.genre || details.genre,
    duration: song.duration || details.duration,
    datePublished: song.releaseDate || details.releaseDate,
    byArtist: {
      '@type': 'MusicGroup',
      name: artist,
      ...(artistPath ? { '@id': `${SITE_URL}${artistPath}#artist`, url: `${SITE_URL}${artistPath}` } : {}),
    },
    inAlbum: albumTitle ? {
      '@type': 'MusicAlbum',
      name: albumTitle,
      ...(albumPath ? { '@id': `${SITE_URL}${albumPath}#album`, url: `${SITE_URL}${albumPath}` } : {}),
    } : undefined,
    audio: publicAsset(getPreviewUrl(song)) ? { '@type': 'AudioObject', contentUrl: publicAsset(getPreviewUrl(song)) } : undefined,
  };
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', path: '/' },
    artistPath ? { name: artist, path: artistPath } : { name: 'Music', path: '/music' },
    ...(albumPath && albumTitle ? [{ name: albumTitle, path: albumPath }] : []),
    { name: title, path },
  ]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
