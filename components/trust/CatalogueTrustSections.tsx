'use client';

import { Globe2, Headphones, LibraryBig, MonitorSmartphone, Music2, RadioTower } from 'lucide-react';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './CatalogueTrustSections.module.css';

type Song = PublicRecord;
type Album = PublicRecord;
type Artist = PublicRecord;
type Video = PublicRecord;

export function CatalogueTrustSections() {
  const { items: songs } = usePublishedCollection<Song>('songs', []);
  const { items: albums } = usePublishedCollection<Album>('albums', []);
  const { items: artists } = usePublishedCollection<Artist>('artists', []);
  const { items: videos } = usePublishedCollection<Video>('videos', []);

  const metrics = [
    { value: songs.length, label: 'Official songs', Icon: Music2 },
    { value: albums.length, label: 'Albums & EPs', Icon: LibraryBig },
    { value: artists.length, label: 'Aureon artists', Icon: Headphones },
    { value: videos.length, label: 'Official videos', Icon: RadioTower },
  ];

  return <section className={styles.wrap} aria-label="Aureon catalogue and global access">
    <article className={styles.panel}>
      <p className={styles.eyebrow}>Growing catalogue</p>
      <h2>New music. New stories. Added continuously.</h2>
      <p className={styles.intro}>Every published release is part of Aureon’s official catalogue, professionally presented and available through one premium destination.</p>
      <div className={styles.metrics}>{metrics.map(({ value, label, Icon }) => <div key={label}><Icon size={18}/><strong>{value}+</strong><span>{label}</span></div>)}</div>
    </article>
    <article className={styles.panel}>
      <p className={styles.eyebrow}>Global availability</p>
      <h2>Your Aureon experience travels with you.</h2>
      <p className={styles.intro}>Discover and enjoy Aureon across modern browsers and devices wherever internet access is available.</p>
      <div className={styles.access}><span><Globe2 size={18}/>Worldwide access</span><span><MonitorSmartphone size={18}/>Desktop, mobile and tablet</span><span><Headphones size={18}/>High-quality listening</span></div>
    </article>
  </section>;
}
