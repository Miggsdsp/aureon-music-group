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
  const { items } = usePublishedCollection<Artist>('artists', [], true);
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
  const hasPortrait = Boolean(artist.profileImageUrl);
  const image = artist.profileImageUrl || artist.logoUrl || '/images/branding/Aureon_Header_Logo.png';

  return (
    <section className={styles.section} aria-label="Featured Aureon artists">
      <div className={styles.heading}>
        <div><p className="eyebrow">Artists of Aureon</p><h2>Find your next favourite</h2></div>
        <Link href="/artists" className="ghost-button">Meet all artists <span aria-hidden="true">→</span></Link>
      </div>
      <div className={styles.stage}>
        <div className={`${styles.visual} ${hasPortrait ? styles.portrait : styles.logo}`}>
          <img key={artist.id} src={image} alt={hasPortrait ? `Portrait of ${artist.name || 'Aureon artist'}` : `${artist.name || 'Aureon artist'} artwork`} loading="lazy" decoding="async" />
        </div>
        <div className={styles.copy}>
          <span className={styles.genre}>{artist.genre || 'Featured artist'}</span>
          <h3>{artist.name}</h3>
          {artist.description && <p className={styles.description}>{artist.description}</p>}
          <div className={styles.actions}>
            <Link className="primary-button" href={`/artists/${artist.slug || artist.id}`}>Explore artist <span aria-hidden="true">→</span></Link>
            {artists.length > 1 && <>
              <button className={styles.arrow} type="button" aria-label="Previous artist" onClick={() => setIndex(value => (value - 1 + artists.length) % artists.length)}>‹</button>
              <button className={styles.arrow} type="button" aria-label="Next artist" onClick={() => setIndex(value => (value + 1) % artists.length)}>›</button>
            </>}
          </div>
          {artists.length > 1 && <div className={styles.dots} aria-label="Choose featured artist">{artists.map((item, dotIndex) => <button key={item.id} type="button" aria-label={`Show ${item.name || 'artist'}`} aria-current={dotIndex === index ? 'true' : undefined} className={`${styles.dot} ${dotIndex === index ? styles.active : ''}`} onClick={() => setIndex(dotIndex)} />)}</div>}
        </div>
        <div className={styles.counter} aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><i />{String(artists.length).padStart(2, '0')}</div>
      </div>
    </section>
  );
}
