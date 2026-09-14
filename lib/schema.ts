import { canonicalArtistIdentity } from '@/lib/artist-identity';
import { SITE_URL, text } from '@/lib/seo';

export function musicRecordingSchema(song: Record<string, any>) {
  const slug = song.slug || song.id;
  const identity = canonicalArtistIdentity(song);
  const artistName = identity?.name || text(song.artistName || song.artist);
  const artistUrl = identity?.slug ? `${SITE_URL}/artists/${identity.slug}` : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    '@id': `${SITE_URL}/songs/${slug}#recording`,
    name: text(song.title || song.name, 'Aureon recording'),
    url: `${SITE_URL}/songs/${slug}`,
    image: song.coverImageUrl || song.imageUrl,
    duration: song.isoDuration,
    datePublished: song.releaseDate,
    genre: song.genre,
    byArtist: artistName ? {
      '@type': 'MusicGroup',
      name: artistName,
      ...(artistUrl ? { '@id': `${artistUrl}#artist`, url: artistUrl } : {}),
    } : undefined,
    inAlbum: song.albumTitle ? { '@type': 'MusicAlbum', name: song.albumTitle } : undefined,
    isrcCode: song.isrc || undefined,
  };
}

export function playlistSchema(playlist: Record<string, any>) {
  const slug = playlist.slug || playlist.id;
  const songs = Array.isArray(playlist.songs) ? playlist.songs : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicPlaylist',
    '@id': `${SITE_URL}/playlists/${slug}#playlist`,
    name: text(playlist.title || playlist.name, 'Aureon playlist'),
    description: text(playlist.description),
    url: `${SITE_URL}/playlists/${slug}`,
    image: playlist.coverImageUrl || playlist.imageUrl,
    numTracks: playlist.trackCount || songs.length,
    track: songs.map(musicRecordingSchema),
  };
}

export function faqSchema(faqs: Array<{ question?: string; answer?: string }>) {
  const valid = faqs.filter(item => item.question && item.answer);
  if (!valid.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map(item => ({
      '@type': 'Question',
      name: text(item.question),
      acceptedAnswer: { '@type': 'Answer', text: text(item.answer) },
    })),
  };
}
