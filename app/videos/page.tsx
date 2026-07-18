'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clapperboard, ExternalLink, Film, Play } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type VideoAlbumRecord = PublicRecord & {
  title: string;
  slug?: string;
  artist?: string;
  artistName?: string;
  genre?: string;
  year?: string | number;
  releaseDate?: string;
  coverUrl?: string;
  coverImageUrl?: string;
  thumbnailUrl?: string;
  videoCount?: number;
  videos?: unknown[];
};

type VideoRecord = PublicRecord & {
  title?: string;
  slug?: string;
  artistName?: string;
  type?: string;
  duration?: string;
  releaseDate?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  externalUrl?: string;
  youtubeUrl?: string;
  vimeoUrl?: string;
  shortForm?: boolean;
};

function videoHref(video: VideoRecord) {
  return video.externalUrl || video.youtubeUrl || video.vimeoUrl || video.videoUrl || '';
}

export default function VideosPage() {
  const { items: videoAlbums, loading: albumsLoading } =
    usePublishedCollection<VideoAlbumRecord>('videoAlbums', []);
  const { items: videos, loading: videosLoading } =
    usePublishedCollection<VideoRecord>('videos', []);
  const loading = albumsLoading || videosLoading;

  return (
    <PageShell title="Videos" kicker="Visual World">
      <section className="music-intro video-intro">
        <div>
          <p className="eyebrow">Aureon Visual Catalogue</p>
          <h2>Music videos and visual releases</h2>
        </div>
        <p>
          Every published video uploaded through the Aureon Control Center appears here
          automatically.
        </p>
      </section>

      {loading ? (
        <div className="store-empty"><h3>Loading videos…</h3></div>
      ) : (
        <>
          {videos.length > 0 && (
            <section className="content-panel video-catalogue-section">
              <div className="section-heading">
                <div><p className="eyebrow">Watch now</p><h2>Latest videos</h2></div>
              </div>
              <div className="news-grid">
                {videos.map(video => {
                  const href = videoHref(video);
                  const card = (
                    <article className="news-card video-release-card">
                      <div className="video-release-thumb">
                        <Image
                          src={video.thumbnailUrl || '/images/branding/Aureon_Header_Logo.png'}
                          alt={`${video.title || 'Aureon video'} thumbnail`}
                          width={900}
                          height={600}
                          unoptimized
                        />
                        <span><Play size={24} /></span>
                      </div>
                      <p className="eyebrow">
                        {video.shortForm ? 'Short-form clip' : video.type || 'Music video'}
                      </p>
                      <h3>{video.title || 'Untitled video'}</h3>
                      <p>{video.artistName || 'Aureon Music Group'}{video.duration ? ` · ${video.duration}` : ''}</p>
                      <strong>Watch video <ExternalLink size={14} /></strong>
                    </article>
                  );
                  return href ? (
                    <a key={video.id} href={href} target="_blank" rel="noreferrer">{card}</a>
                  ) : (
                    <div key={video.id}>{card}</div>
                  );
                })}
              </div>
            </section>
          )}

          {videoAlbums.length > 0 && (
            <section className="content-panel video-catalogue-section">
              <div className="section-heading">
                <div><p className="eyebrow">Collections</p><h2>Video albums</h2></div>
              </div>
              <div className="album-grid video-album-grid">
                {videoAlbums.map(album => {
                  const cover = album.coverImageUrl || album.coverUrl || album.thumbnailUrl || '/images/branding/Aureon_Header_Logo.png';
                  const count = album.videoCount ?? album.videos?.length ?? videos.filter(video => (video as any).videoAlbumId === album.id).length;
                  return (
                    <Link href={`/videos/${album.slug || album.id}`} className="album-card video-album-card" key={album.id}>
                      <div className="album-cover video-cover">
                        <Image src={cover} alt={`${album.title} video album artwork`} width={900} height={900} unoptimized />
                        <div className="video-play-mark"><Film size={28} /></div>
                      </div>
                      <div className="album-card-copy">
                        <p>{album.releaseDate || album.year || ''}</p>
                        <h3>{album.title}</h3>
                        <strong>{album.artistName || album.artist || ''}</strong>
                        <span>{album.genre || ''}</span>
                        <div className="album-meta"><Clapperboard size={15} />{count} videos</div>
                        <em>Open video album →</em>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {!videos.length && !videoAlbums.length && (
            <div className="store-empty">
              <h3>No published videos yet</h3>
              <p>Upload and publish a video in the Aureon Control Center.</p>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
