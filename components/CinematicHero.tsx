'use client';

import Link from 'next/link';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export function CinematicHero() {
  const { data } = usePublishedDocument<any>('sitePages', 'home', {
    title: 'Aureon Music Group homepage',
    artistsHref: '/artists', musicHref: '/music', videosHref: '/videos', newsHref: '/news', merchandiseHref: '/merchandise', aboutHref: '/about', contactHref: '/contact',
    announcement: '', heroImage: ''
  });
  const style = data?.heroImage ? { backgroundImage: `url(${data.heroImage})` } : undefined;
  return (
    <section className="hero approved-hero" aria-label={data?.title || 'Aureon Music Group homepage'} style={style}>
      <div className="cinematic-fx light-fx" aria-hidden="true" />
      <div className="cinematic-fx dust-fx" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      <div className="cinematic-fx led-fx" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      {data?.announcement ? <div className="homepage-firestore-announcement">{data.announcement}</div> : null}
      <Link className="hotspot nav-about" href={data?.aboutHref || '/about'} aria-label="About" />
      <Link className="hotspot nav-artists" href={data?.artistsHref || '/artists'} aria-label="Artists" />
      <Link className="hotspot nav-music" href={data?.musicHref || '/music'} aria-label="Music" />
      <Link className="hotspot nav-videos" href={data?.videosHref || '/videos'} aria-label="Videos" />
      <Link className="hotspot nav-news" href={data?.newsHref || '/news'} aria-label="News" />
      <Link className="hotspot nav-merch" href={data?.merchandiseHref || '/merchandise'} aria-label="Merchandise" />
      <Link className="hotspot nav-contact" href={data?.contactHref || '/contact'} aria-label="Contact" />
      <Link className="hotspot join-hotspot" href={data?.contactHref || '/contact'} aria-label="Join the journey" />
      <Link className="hotspot discover-hotspot" href={data?.artistsHref || '/artists'} aria-label="Discover our artists" />
      <Link className="hotspot mission-hotspot" href={data?.aboutHref || '/about'} aria-label="Our mission" />
      <Link className="hotspot release-hotspot" href={data?.musicHref || '/music'} aria-label="Latest release" />
      <Link className="hotspot journey-hotspot" href={data?.contactHref || '/contact'} aria-label="Join the journey" />
      <Link className="hotspot follow-hotspot" href={data?.contactHref || '/contact'} aria-label="Follow us" />
    </section>
  );
}
