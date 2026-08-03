'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { recommendAlbums, type RecommendationEntity } from '@/lib/recommendations';
import styles from './SimilarAlbums.module.css';

type AlbumRecord = RecommendationEntity & {
  title?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  genre?: string;
  mood?: string;
  releaseDate?: string;
  year?: string | number;
  coverImageUrl?: string;
  coverUrl?: string;
  details?: Record<string, any>;
};

type SongRecord = {
  id: string;
  title?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  albumSlug?: string;
  previewUrl?: string;
  trackNumber?: number;
  details?: Record<string, any>;
};

const normalise = (value: unknown) => String(value || '').trim().toLowerCase();

function releaseYear(album: AlbumRecord) {
  const details = album.details || {};
  const raw = album.releaseDate || details.releaseDate || album.year || details.year;
  const year = Number(String(raw || '').slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function belongsToAlbum(song: SongRecord, album: AlbumRecord) {
  const details = song.details || {};
  const albumDetails = album.details || {};
  return (
    normalise(song.albumId || details.albumId) === normalise(album.id) ||
    normalise(song.albumSlug || details.albumSlug) === normalise(album.slug) ||
    normalise(song.albumTitle || details.albumTitle) === normalise(album.title || albumDetails.title)
  );
}

export function SimilarAlbums({ currentAlbum, albums, songs }: { currentAlbum: AlbumRecord; albums: AlbumRecord[]; songs: SongRecord[] }) {
  const currentYear = releaseYear(currentAlbum);
  const base = recommendAlbums(albums, { seed: currentAlbum, limit: 12 });
  const recommendations = base
    .map(result => {
      const candidateYear = releaseYear(result.item);
      const eraScore = currentYear && candidateYear ? Math.max(0, 1 - Math.abs(currentYear - candidateYear) / 12) : 0;
      return { ...result, combinedScore: result.score + eraScore * 10 };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore || b.confidence - a.confidence)
    .slice(0, 4);

  if (!recommendations.length) return null;

  return (
    <section className={styles.section} aria-labelledby="similar-albums-heading">
      <div className={styles.heading}>
        <Disc3 size={24} />
        <div>
          <p className="eyebrow">Keep Discovering</p>
          <h2 id="similar-albums-heading">More Albums Like This</h2>
        </div>
      </div>
      <div className={styles.grid}>
        {recommendations.map(({ item, confidence }) => {
          const details = item.details || {};
          const artwork = item.coverImageUrl || details.coverImageUrl || item.coverUrl || '/images/branding/Aureon_Header_Logo.png';
          const artist = item.artistName || details.artistName || 'Aureon Artist';
          const artistSlug = item.artistSlug || details.artistSlug || '';
          const leadTrack = songs
            .filter(song => belongsToAlbum(song, item))
            .sort((a, b) => Number(a.trackNumber ?? a.details?.trackNumber ?? 999) - Number(b.trackNumber ?? b.details?.trackNumber ?? 999))
            .find(song => Boolean(song.previewUrl || song.details?.previewUrl));
          const preview = leadTrack?.previewUrl || leadTrack?.details?.previewUrl || '';
          return (
            <article className={styles.card} key={String(item.id || item.slug)}>
              <Link className={styles.artwork} href={`/music/${item.slug || item.id}`} aria-label={`View ${item.title} album`}>
                <Image src={artwork} alt={`${item.title || 'Album'} artwork`} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" />
              </Link>
              <div className={styles.copy}>
                <span className={styles.match}>{Math.round(confidence * 100)}% match</span>
                <h3><Link href={`/music/${item.slug || item.id}`}>{item.title || 'Untitled album'}</Link></h3>
                {artistSlug ? <Link className={styles.artist} href={`/artists/${artistSlug}`}>{artist}</Link> : <p className={styles.artist}>{artist}</p>}
                {preview && leadTrack ? (
                  <LatestPlayButton
                    title={leadTrack.title || item.title || 'Album preview'}
                    src={preview}
                    buttonLabel="Play album preview"
                    showPurchase={false}
                    analytics={{
                      id: leadTrack.id,
                      artistId: leadTrack.artistId || leadTrack.details?.artistId,
                      artistName: leadTrack.artistName || leadTrack.details?.artistName || artist,
                      albumId: String(item.id || ''),
                      albumTitle: item.title || '',
                    }}
                  />
                ) : <span className={styles.unavailable}>Preview coming soon</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
