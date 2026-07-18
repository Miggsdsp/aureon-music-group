'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ExternalLink, ListMusic, Music2, Play } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type SongRecord = PublicRecord & {
  title?: string; name?: string; slug?: string; artistId?: string; artistName?: string;
  artistSlug?: string; albumId?: string; albumTitle?: string; trackNumber?: number;
  duration?: string; price?: number; promotional?: boolean; purchasable?: boolean;
  previewUrl?: string; audioUrl?: string; coverImageUrl?: string;
  details?: Record<string, any>;
};

type VideoRecord = PublicRecord & {
  title?: string; artistId?: string; artistName?: string; artistSlug?: string;
  type?: string; duration?: string; thumbnailUrl?: string; videoUrl?: string;
  externalUrl?: string; youtubeUrl?: string; vimeoUrl?: string; shortForm?: boolean;
  details?: Record<string, any>;
};

function normalise(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default function ArtistProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: artist, loading } = usePublishedDocument<any>('artists', slug, null);
  const { items: publishedSongs, loading: songsLoading } = usePublishedCollection<SongRecord>('songs', []);
  const { items: publishedVideos, loading: videosLoading } = usePublishedCollection<VideoRecord>('videos', []);

  if (!artist && !loading) {
    return <main className="page-shell"><Header /><section className="content-panel"><h1>Artist not found</h1><p>This artist has not been published in the Control Center.</p></section><Footer /></main>;
  }
  if (!artist) return null;

  const logo = artist.logoUrl || artist.profileImageUrl || artist.image || '/images/branding/Aureon_Header_Logo.png';
  const sound = Array.isArray(artist.sound) ? artist.sound : String(artist.sound || '').split(',').filter(Boolean);
  const artistName = artist.name || artist.title || '';
  const artistSlug = artist.slug || slug;
  const ids = new Set([normalise(artist.id), normalise(artist.artistCode), normalise(artistSlug), normalise(artistName)].filter(Boolean));
  const belongsToArtist = (record: any) => {
    const details = record.details || {};
    return [record.artistId, details.artistId, record.artistSlug, details.artistSlug, record.artistName, details.artistName]
      .map(normalise)
      .filter(Boolean)
      .some(value => ids.has(value));
  };

  const songs = publishedSongs
    .filter(belongsToArtist)
    .sort((a, b) => {
      const at = Number(a.trackNumber ?? a.details?.trackNumber ?? 9999);
      const bt = Number(b.trackNumber ?? b.details?.trackNumber ?? 9999);
      return at !== bt ? at - bt : String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''));
    });
  const videos = publishedVideos.filter(belongsToArtist);
  const latest = songs[0];
  const latestPreview = latest?.previewUrl || latest?.details?.previewUrl || '';

  return (
    <main className="page-shell artist-profile-page">
      <Header />
      <section className={`artist-profile-hero artist-${artist.slug}`}>
        <div className="artist-profile-logo-wrap"><Image src={logo} alt={`${artistName} logo`} width={1000} height={1000} unoptimized className="artist-profile-logo" /></div>
        <div className="artist-profile-copy">
          <Link href="/artists" className="back-link"><ArrowLeft size={16} /> Back to artists</Link>
          <p className="eyebrow">{artist.artistCode || artist.id} · {artist.genre || ''}</p>
          <h1>{artistName}</h1>
          <p className="artist-profile-desc">{artist.bio || artist.description || ''}</p>
          {latestPreview ? <LatestPlayButton title={latest?.title || latest?.name || 'Latest release'} src={latestPreview} /> : null}
        </div>
      </section>

      <section className="artist-profile-panel">
        <div><p className="eyebrow">Sound Identity</p><h2>{artistName} sound profile</h2><p>{artist.description || ''}</p></div>
        <div className="artist-sound-list">{sound.map((item: string) => <article key={item}><Music2 size={20} /><span>{item.trim()}</span></article>)}</div>
      </section>

      <section className="album-track-section">
        <div className="album-track-heading"><ListMusic /><div><p className="eyebrow">Official Catalogue</p><h2>{artistName} songs</h2></div></div>
        {songsLoading ? <p>Loading music…</p> : songs.length ? (
          <div className="track-list">{songs.map((song, index) => {
            const details = song.details || {};
            const title = song.title || song.name || 'Untitled song';
            const preview = song.previewUrl || details.previewUrl || '';
            const price = Number(song.price ?? details.price ?? 0.99);
            const promotional = Boolean(song.promotional ?? details.promotional);
            const purchasable = song.purchasable !== false && details.purchasable !== false;
            const image = song.coverImageUrl || details.coverImageUrl || logo;
            return <article className="track-row" key={song.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{title}</h3><p>{song.albumTitle || details.albumTitle || 'Single'} · {song.duration || details.duration || ''} · {promotional ? 'Free release' : `Digital download €${price.toFixed(2)}`}</p></div><LatestPlayButton title={title} src={preview} purchase={purchasable ? { id: song.id, title, artist: artistName, image, price, promotional } : undefined} /></article>;
          })}</div>
        ) : <p className="preview-ended-message">No published songs have been uploaded for this artist yet.</p>}
      </section>

      <section className="content-panel artist-video-section">
        <div className="section-heading"><div><p className="eyebrow">Visual catalogue</p><h2>{artistName} videos</h2></div></div>
        {videosLoading ? <p>Loading videos…</p> : videos.length ? (
          <div className="news-grid">{videos.map(video => {
            const href = video.externalUrl || video.youtubeUrl || video.vimeoUrl || video.videoUrl || '';
            return <article className="news-card video-release-card" key={video.id}><div className="video-release-thumb"><Image src={video.thumbnailUrl || logo} alt={`${video.title || artistName} video thumbnail`} width={900} height={600} unoptimized /><span><Play size={22} /></span></div><p className="eyebrow">{video.shortForm ? 'Short-form clip' : video.type || 'Music video'}</p><h3>{video.title || 'Untitled video'}</h3><p>{video.duration || ''}</p>{href ? <a href={href} target="_blank" rel="noreferrer">Watch video <ExternalLink size={14} /></a> : <span>Video file preparing</span>}</article>;
          })}</div>
        ) : <p className="preview-ended-message">No published videos have been uploaded for this artist yet.</p>}
      </section>

      <Footer />
    </main>
  );
}
