'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import styles from './CinematicHero.module.css';

type HeroSettings = {
  heroVideoUrl?: string;
  heroOverlayOpacity?: number;
};

export function CinematicHero() {
  const { data } = usePublishedDocument<any>('sitePages', 'home', {
    title: 'Aureon Music Group homepage',
    artistsHref: '/artists', musicHref: '/music', videosHref: '/videos', newsHref: '/news',
    merchandiseHref: '/merchandise', aboutHref: '/about', contactHref: '/contact',
    announcement: '', heroImage: ''
  });
  const { data: platform, loading: platformLoading } = usePublishedDocument<HeroSettings>('siteSettings', 'platform', {
    heroVideoUrl: '', heroOverlayOpacity: 58
  });
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const videoUrl = String(platform?.heroVideoUrl || '').trim();
  // The stored value is an editor percentage. Keep it deliberately restrained;
  // the media layer already has its own legibility gradient.
  const overlayOpacity = Math.min(100, Math.max(0, Number(platform?.heroOverlayOpacity ?? 58))) / 100 * 0.32;

  useEffect(() => { setVideoReady(false); setVideoFailed(false); }, [videoUrl]);

  return (
    <section className={`hero approved-hero ${styles.heroFix}`} aria-label={data?.title || 'Aureon Music Group homepage'}>
      <div className={styles.videoLoadingBackground} aria-hidden="true" />

      <h1 className={styles.heroHeadline}>Music for<br />a brighter tomorrow</h1>

      {!platformLoading && videoUrl && !videoFailed ? (
        <video
          key={videoUrl}
          src={videoUrl}
          className={`${styles.heroVideo} ${videoReady ? styles.heroVideoReady : ''}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onCanPlay={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => { setVideoFailed(true); setVideoReady(false); }}
          poster="/images/aureon-eclipse-ocean-poster.webp"
          aria-hidden="true"
        />
      ) : null}

      <div className={styles.videoShade} style={{ opacity: overlayOpacity }} aria-hidden="true" />
      <div className={styles.heroOverlay}>
        
        <p className={styles.slogan}>ORIGINAL ARTISTS. TIMELESS MUSIC.</p>
        
        <div className={styles.heroActions}>
          <Link className={styles.discoverButton} href="/discover"><span aria-hidden="true">▶</span> START LISTENING <span aria-hidden="true">→</span></Link>
          <Link className={styles.accountButton} href="/membership">EXPLORE MEMBERSHIP</Link>
        </div>
      </div>

      {data?.announcement ? <div className="homepage-firestore-announcement">{data.announcement}</div> : null}
    </section>
  );
}
