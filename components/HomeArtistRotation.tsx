'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './HomeArtistRotation.module.css';

type Artist = PublicRecord & {
  name?: string;
  slug?: string;
  genre?: string;
  description?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  featured?: boolean;
};

export function HomeArtistRotation() {
  const { items } = usePublishedCollection<Artist>('artists', []);
  const artists = useMemo(() => {
    const featured = items.filter(item => item.featured);
    return featured.length ? featured : items;
  }, [items]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [artists.length]);
  useEffect(() => {
    if (artists.length < 2) return;
    const timer = window.setInterval(() => setIndex(value => (value + 1) % artists.length), 6500);
    return () => window.clearInterval(timer);
  }, [artists.length]);

  if (!artists.length) return null;
  const artist = artists[index % artists.length];
  const image = artist.logoUrl || artist.profileImageUrl || '/images/branding/Aureon_Header_Logo.png';

  return (
    <section className={styles.section} aria-label="Featured Aureon artists">
      <div className={styles.heading}>
        <div><p className="eyebrow">Featured artists</p><h2>Meet the sound of Aureon</h2></div>
        <Link href="/artists" className="ghost-button">View all artists →</Link>
      </div>
      <div className={styles.stage}>
        <div className={styles.visual}><img key={artist.id} src={image} alt={`${artist.name || 'Aureon artist'} logo`} /></div>
        <div className={styles.copy}>
          <span className={styles.genre}>{artist.genre || 'Aureon Artist'}</span>
          <h3>{artist.name}</h3>
          <p className={styles.description}>{artist.description || 'Discover this artist and their latest music from Aureon Music Group.'}</p>
          <div className={styles.actions}>
            <Link className="primary-button" href={`/artists/${artist.slug || artist.id}`}>View artist →</Link>
            {artists.length > 1 && <>
              <button className={styles.arrow} type="button" aria-label="Previous artist" onClick={() => setIndex(value => (value - 1 + artists.length) % artists.length)}>‹</button>
              <button className={styles.arrow} type="button" aria-label="Next artist" onClick={() => setIndex(value => (value + 1) % artists.length)}>›</button>
            </>}
          </div>
          {artists.length > 1 && <div className={styles.dots}>{artists.map((item, dotIndex) => <button key={item.id} type="button" aria-label={`Show ${item.name || 'artist'}`} className={`${styles.dot} ${dotIndex === index ? styles.active : ''}`} onClick={() => setIndex(dotIndex)} />)}</div>}
        </div>
      </div>
    </section>
  );
}
