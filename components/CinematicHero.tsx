'use client';

import Link from 'next/link';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { useSiteFeatures } from '@/lib/useSiteFeatures';
import styles from './CinematicHero.module.css';

type HeroSettings = {
  heroVideoUrl?: string;
  heroPosterUrl?: string;
  heroOverlayOpacity?: number;
  heroLightEffects?: boolean;
  heroDustEffects?: boolean;
  heroLedEffects?: boolean;
  heroLogoScale?: number;
};

export function CinematicHero() {
  const { features } = useSiteFeatures();
  const { data } = usePublishedDocument<any>('sitePages', 'home', {
    title: 'Aureon Music Group homepage',
    artistsHref: '/artists', musicHref: '/music', videosHref: '/videos', newsHref: '/news',
    merchandiseHref: '/merchandise', aboutHref: '/about', contactHref: '/contact',
    announcement: '', heroImage: ''
  });
  const { data: platform } = usePublishedDocument<HeroSettings>('siteSettings', 'platform', {
    heroVideoUrl: '', heroPosterUrl: '', heroOverlayOpacity: 58,
    heroLightEffects: true, heroDustEffects: true, heroLedEffects: true, heroLogoScale: 100
  });

  const poster = platform?.heroPosterUrl || data?.heroImage || '/images/aureon-hero-cinematic.webp';
  const videoUrl = String(platform?.heroVideoUrl || '').trim() || '/videos/aureon-home-hero.mp4';
  const overlayOpacity = Math.min(100, Math.max(0, Number(platform?.heroOverlayOpacity ?? 58))) / 100;
  const logoScale = Math.min(150, Math.max(60, Number(platform?.heroLogoScale ?? 100)));

  return (
    <section className={`hero approved-hero ${styles.heroFix}`} aria-label={data?.title || 'Aureon Music Group homepage'}>
      <video
        key={videoUrl}
        src={videoUrl}
        className={styles.heroVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster={poster}
        aria-hidden="true"
      />

      <div className={styles.videoShade} style={{ opacity: overlayOpacity }} aria-hidden="true" />
      {platform?.heroLightEffects !== false && <div className="cinematic-fx light-fx" aria-hidden="true" />}
      {platform?.heroDustEffects !== false && <div className="cinematic-fx dust-fx" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>}
      {platform?.heroLedEffects !== false && <div className="cinematic-fx led-fx" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>}

      <div className={styles.heroOverlay}>
        <img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group" width="760" height="260" className={styles.heroLogo} style={{ width: `${logoScale}%`, maxWidth: 760, height: 'auto' }} decoding="async" fetchPriority="high" />
        <p className={styles.slogan}>CREATING TOMORROW’S CLASSICS</p>
        <Link className={styles.discoverButton} href={data?.artistsHref || '/artists'}>DISCOVER OUR ARTISTS <span aria-hidden="true">↓</span></Link>
      </div>

      {data?.announcement ? <div className="homepage-firestore-announcement">{data.announcement}</div> : null}
      <Link className="hotspot nav-about" href={data?.aboutHref || '/about'} aria-label="About" />
      <Link className="hotspot nav-artists" href={data?.artistsHref || '/artists'} aria-label="Artists" />
      <Link className="hotspot nav-music" href={data?.musicHref || '/music'} aria-label="Music" />
      <Link className="hotspot nav-videos" href={data?.videosHref || '/videos'} aria-label="Videos" />
      <Link className="hotspot nav-news" href={data?.newsHref || '/news'} aria-label="News" />
      {features.merchandiseEnabled && <Link className="hotspot nav-merch" href={data?.merchandiseHref || '/merchandise'} aria-label="Merchandise" />}
      <Link className="hotspot nav-contact" href={data?.contactHref || '/contact'} aria-label="Contact" />
      <Link className="hotspot join-hotspot" href={data?.contactHref || '/contact'} aria-label="Join the journey" />
      <Link className="hotspot mission-hotspot" href={data?.aboutHref || '/about'} aria-label="Our mission" />
      <Link className="hotspot release-hotspot" href={data?.musicHref || '/music'} aria-label="Latest release" />
      <Link className="hotspot journey-hotspot" href={data?.contactHref || '/contact'} aria-label="Join the journey" />
      <Link className="hotspot follow-hotspot" href={data?.contactHref || '/contact'} aria-label="Follow us" />
    </section>
  );
}
