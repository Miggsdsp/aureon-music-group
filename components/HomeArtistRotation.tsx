'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './HomeArtistRotation.module.css';

type Artist = PublicRecord & {
  name?: string;
  slug?: string;
  genre?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  featured?: boolean;
};

export function HomeArtistRotation() {
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
          const hasPortrait = Boolean(artist.profileImageUrl);
          const image = artist.profileImageUrl || artist.logoUrl || '/images/branding/Aureon_Header_Logo.png';
          return (
            <Link key={artist.id} className={styles.artistTile} href={`/artists/${artist.slug || artist.id}`} aria-label={`Explore ${artist.name || 'Aureon artist'}`}>
              <span className={`${styles.tileArtwork} ${hasPortrait ? styles.tilePortrait : styles.tileLogo}`}>
                <img src={image} alt={artist.name ? `${artist.name} artwork` : 'Aureon artist artwork'} loading="lazy" decoding="async" />
                <span className={styles.tileShine} aria-hidden="true" />
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
