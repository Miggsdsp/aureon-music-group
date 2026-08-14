'use client';

import Link from 'next/link';
import { Clapperboard, Film, Play } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { ArtworkImage } from '@/components/ArtworkImage';
import { getArtwork } from '@/lib/get-artwork';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './VideosPage.module.css';

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
  details?: Record<string, any>;
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
  details?: Record<string, any>;
};

export default function VideosPage() {
  const { items: videoAlbums, loading: albumsLoading } = usePublishedCollection<VideoAlbumRecord>('videoAlbums', []);
  const { items: videos, loading: videosLoading } = usePublishedCollection<VideoRecord>('videos', []);
  const loading = albumsLoading || videosLoading;

  return (
    <PageShell title="Videos" kicker="Visual World">
      <section className="music-intro video-intro">
        <div>
          <p className="eyebrow">Aureon Visual Catalogue</p>
          <h2>Music videos and visual releases</h2>
        </div>
        <p>Every published video uploaded through the Aureon Control Center appears here automatically.</p>
      </section>

      {loading ? (
        <div className="store-empty"><h3>Loading videos…</h3></div>
      ) : (
        <>
          {videos.length > 0 && (
            <section className={styles.section}>
              <div className={styles.heading}>
                <div><p className={styles.eyebrow}>Watch now</p><h2>Latest videos</h2></div>
              </div>
              <div className={styles.grid}>
                {videos.map(video => {
                  const details = video.details || {};
                  const title = video.title || details.title || 'Untitled video';
                  const artist = video.artistName || details.artistName || 'Aureon Music Group';
                  const duration = video.duration || details.duration || '';
                  const type = video.shortForm || details.shortForm ? 'Short-form clip' : video.type || details.type || 'Music video';
                  return (
                    <Link key={video.id} href={`/videos/${video.slug || video.id}`} className={styles.cardLink}>
                      <article className={styles.card}>
                        <div className={styles.thumb}>
                          <ArtworkImage src={getArtwork(video)} alt={`${title} thumbnail`} fill sizes="(max-width:620px) 100vw, (max-width:900px) 38vw, 21vw" />
                          <span className={styles.playMark}><Play size={24} /></span>
                        </div>
                        <div className={styles.copy}>
                          <span className={styles.official}>Official Aureon Video</span>
                          <p className={styles.eyebrow}>{type}</p>
                          <h3>{title}</h3>
                          <p className={styles.meta}>{artist}{duration ? ` · ${duration}` : ''}</p>
                          <strong className={styles.cta}>Play on Aureon →</strong>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {videoAlbums.length > 0 && (
            <section className={styles.section}>
              <div className={styles.heading}>
                <div><p className={styles.eyebrow}>Collections</p><h2>Video albums</h2></div>
              </div>
              <div className={styles.albumGrid}>
                {videoAlbums.map(album => {
                  const details = album.details || {};
                  const title = album.title || details.title || 'Untitled collection';
                  const artist = album.artistName || details.artistName || album.artist || details.artist || '';
                  const genre = album.genre || details.genre || '';
                  const count = album.videoCount ?? details.videoCount ?? album.videos?.length ?? videos.filter(video => (video as any).videoAlbumId === album.id || video.details?.videoAlbumId === album.id).length;
                  return (
                    <Link href={`/videos/${album.slug || album.id}`} className={styles.albumCard} key={album.id}>
                      <div className={styles.albumArt}>
                        <ArtworkImage src={getArtwork(album)} alt={`${title} video album artwork`} fill sizes="(max-width:620px) 100vw, (max-width:1000px) 50vw, 25vw" />
                        <span className={styles.playMark}><Film size={28} /></span>
                      </div>
                      <div className={styles.albumBody}>
                        <p>{album.releaseDate || details.releaseDate || album.year || details.year || ''}</p>
                        <h3>{title}</h3>
                        <strong>{artist}</strong>
                        <span>{genre}</span>
                        <div className={styles.albumMeta}><Clapperboard size={15} />{count} videos</div>
                        <em className={styles.albumCta}>Open video album →</em>
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
