'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clapperboard, Film } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type VideoRecord = PublicRecord & {
  title?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  videoAlbumId?: string;
  videoAlbumSlug?: string;
  albumId?: string;
  albumSlug?: string;
  videoUrl?: string;
  externalUrl?: string;
  youtubeUrl?: string;
  vimeoUrl?: string;
  thumbnailUrl?: string;
  duration?: string;
  type?: string;
  trackNumber?: number;
  description?: string;
  details?: Record<string, any>;
};

const norm = (value: unknown) => String(value || '').trim().toLowerCase();

function embedUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : value;
    }
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : value;
    }
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : value;
    }
  } catch {
    return value;
  }
  return value;
}

function VideoPlayer({ video, poster }: { video: VideoRecord; poster: string }) {
  const details = video.details || {};
  const direct = String(video.videoUrl || details.videoUrl || '').trim();
  const external = String(
    video.externalUrl || video.youtubeUrl || video.vimeoUrl || details.externalUrl || ''
  ).trim();

  if (direct) {
    return <video className="aureon-video-player" src={direct} controls preload="metadata" poster={poster} playsInline />;
  }

  if (external) {
    const src = embedUrl(external);
    const embeddable = /youtube\.com\/embed|player\.vimeo\.com/.test(src);
    if (embeddable) {
      return (
        <iframe
          className="aureon-video-player"
          src={src}
          title={video.title || 'Aureon video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      );
    }
    return (
      <div className="video-external-fallback">
        <p>This provider does not allow embedded playback.</p>
        <a className="ghost-button" href={external} target="_blank" rel="noreferrer">Open video →</a>
      </div>
    );
  }

  return <div className="video-external-fallback"><p>Video coming soon.</p></div>;
}

export default function VideoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: video, loading: videoLoading } = usePublishedDocument<any>('videos', slug, null);
  const { data: album, loading: albumLoading } = usePublishedDocument<any>('videoAlbums', slug, null);
  const { items: allVideos } = usePublishedCollection<VideoRecord>('videos', []);
  const loading = videoLoading || albumLoading;

  if (!video && !album && !loading) {
    return (
      <main className="page-shell">
        <Header />
        <section className="content-panel"><h1>Video not found</h1><p>This visual release is not published or has been removed.</p></section>
        <Footer />
      </main>
    );
  }

  if (video) {
    const details = video.details || {};
    const title = video.title || details.title || 'Aureon video';
    const artistName = video.artistName || details.artistName || 'Aureon Music Group';
    const artistSlug = video.artistSlug || details.artistSlug || '';
    const poster = video.thumbnailUrl || details.thumbnailUrl || '/images/branding/Aureon_Header_Logo.png';

    return (
      <main className="page-shell video-detail-page">
        <Header />
        <section className="single-video-page">
          <div className="single-video-heading">
            <Link href="/videos" className="back-link"><ArrowLeft size={16} /> Back to videos</Link>
            <p className="eyebrow">{video.type || details.type || 'Music video'}{video.duration || details.duration ? ` · ${video.duration || details.duration}` : ''}</p>
            <h1>{title}</h1>
            <h2>{artistName}</h2>
          </div>
          <div className="single-video-player-wrap">
            <VideoPlayer video={video as VideoRecord} poster={poster} />
          </div>
          {(video.description || details.description) && <p className="single-video-description">{video.description || details.description}</p>}
          {artistSlug && <Link className="ghost-button" href={`/artists/${artistSlug}`}>View artist profile →</Link>}
        </section>
        <Footer />
      </main>
    );
  }

  if (!album) return null;

  const details = album.details || {};
  const cover = album.coverImageUrl || album.coverUrl || album.thumbnailUrl || details.coverImageUrl || '/images/branding/Aureon_Header_Logo.png';
  const artistName = album.artistName || album.artist || details.artistName || '';
  const artistSlug = album.artistSlug || details.artistSlug || '';
  const videos = allVideos
    .filter(item => {
      const itemDetails = item.details || {};
      const sameAlbum =
        (item.videoAlbumId || itemDetails.videoAlbumId || item.albumId || itemDetails.albumId) === album.id ||
        norm(item.videoAlbumSlug || itemDetails.videoAlbumSlug || item.albumSlug || itemDetails.albumSlug) === norm(album.slug || slug);
      const sameArtist =
        (!artistSlug && !artistName) ||
        norm(item.artistSlug || itemDetails.artistSlug) === norm(artistSlug) ||
        norm(item.artistName || itemDetails.artistName) === norm(artistName);
      return sameAlbum && sameArtist;
    })
    .sort((a, b) => Number(a.trackNumber ?? a.details?.trackNumber ?? 999) - Number(b.trackNumber ?? b.details?.trackNumber ?? 999));

  return (
    <main className="page-shell video-detail-page">
      <Header />
      <section className="album-hero-detail video-hero-detail">
        <div className="album-detail-cover video-detail-cover">
          <Image src={cover} alt={`${album.title} video album artwork`} width={1000} height={1000} unoptimized />
          <div className="video-play-mark large"><Film size={40} /></div>
        </div>
        <div className="album-detail-copy">
          <Link href="/videos" className="back-link"><ArrowLeft size={16} /> Back to video albums</Link>
          <p className="eyebrow">{album.genre || ''} · {album.releaseDate || album.year || ''}</p>
          <h1>{album.title}</h1>
          <h2>{artistName}</h2>
          <p>{album.description || ''}</p>
          {artistSlug && <Link className="ghost-button" href={`/artists/${artistSlug}`}>View artist profile →</Link>}
        </div>
      </section>
      <section className="album-track-section video-list-section">
        <div className="album-track-heading"><Clapperboard /><div><p className="eyebrow">Video List</p><h2>Videos in this album</h2></div></div>
        {videos.length ? (
          <div className="video-list-grid">
            {videos.map((item, index) => {
              const itemDetails = item.details || {};
              const poster = item.thumbnailUrl || itemDetails.thumbnailUrl || cover;
              return (
                <article className="video-row-card" key={item.id}>
                  <div className="video-placeholder">
                    <span>{String(item.trackNumber || itemDetails.trackNumber || index + 1).padStart(2, '0')}</span>
                    <VideoPlayer video={item} poster={poster} />
                  </div>
                  <div>
                    <p className="eyebrow">{item.type || itemDetails.type || 'Music video'} · {item.duration || itemDetails.duration || ''}</p>
                    <h3>{item.title}</h3>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="store-empty"><h3>No published videos yet</h3><p>Upload videos and assign them to this video album in the Control Center.</p></div>
        )}
      </section>
      <Footer />
    </main>
  );
}
