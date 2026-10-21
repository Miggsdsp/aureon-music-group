'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import { getArtwork } from '@/lib/get-artwork';
import { matchesArtist } from '@/lib/public-catalogue';
import { isLogoArtwork } from '@/lib/is-logo-artwork';
import { ArtworkImage } from '@/components/ArtworkImage';
import styles from './HomeArtistRotation.module.css';

type Artist = PublicRecord & {
  name?: string;
  slug?: string;
  genre?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  featuredImageUrl?: string;
  image?: string;
  coverImageUrl?: string;
  artworkUrl?: string;
  media?: Record<string, any>;
  details?: Record<string, any>;
  featured?: boolean;
};

type Album = { id?: string; artistId?: string; artistSlug?: string; artistName?: string; details?: Record<string, any>; [key: string]: any };

export function HomeArtistRotation({ albums = [] }: { albums?: Album[] }) {
  const { items } = usePublishedCollection<Artist>('artists', [], true);
  const artists = useMemo(() => {
    const featured = items.filter(item => item.featured);
    const others = items.filter(item => !item.featured);
    return [...featured, ...others].slice(0, 6);
  }, [items]);

  if (!artists.length) return null;

  return (
    <section className={styles.section} aria-label="Discover Aureon artists">
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">The Aureon Collection</p>
          <h2>Discover our artists</h2>
        </div>
        <Link href="/artists" className={styles.viewAll}>View all artists <span aria-hidden="true">→</span></Link>
      </div>
      <div className={styles.artistGallery}>
        {artists.map(artist => {
          const details = artist.details || {};
          const portraitCandidate = artist.profileImageUrl || artist.featuredImageUrl || artist.image || details.profileImageUrl || details.featuredImageUrl || artist.media?.profileImageUrl || artist.media?.featuredImageUrl;
          const portrait = isLogoArtwork(portraitCandidate) ? '' : portraitCandidate;
          const release = albums.find(album => matchesArtist(album, artist));
          const releaseArtwork = release ? getArtwork(release, '') : '';
          const image = portrait || releaseArtwork || artist.coverImageUrl || artist.artworkUrl || artist.logoUrl || details.logoUrl || '/images/branding/Aureon_Header_Logo.png';
          const artworkStyle = portrait ? styles.tilePortrait : releaseArtwork ? styles.tileRelease : styles.tileLogo;
          return (
            <Link key={artist.id} className={styles.artistTile} href={`/artists/${artist.slug || artist.id}`} aria-label={`Explore ${artist.name || 'Aureon artist'}`}>
              <span className={`${styles.tileArtwork} ${artworkStyle}`}>
                <ArtworkImage src={image} alt={artist.name ? `${artist.name} artwork` : 'Aureon artist artwork'} fill sizes="(max-width: 430px) 46vw, (max-width: 680px) 30vw, (max-width: 1100px) 22vw, 15vw" />
                <span className={styles.tileShine} aria-hidden="true" />
                <span className={styles.playBadge} aria-hidden="true">▶</span>
              </span>
              <span className={styles.tileInfo}>
                <strong>{artist.name || 'Aureon artist'}</strong>
                <small>{artist.genre || 'Original music'}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
