import Link from 'next/link';

export function CinematicHero() {
  return (
    <section className="hero approved-hero" aria-label="Aureon Music Group homepage">
      <Link className="hotspot nav-about" href="/about" aria-label="About" />
      <Link className="hotspot nav-artists" href="/artists" aria-label="Artists" />
      <Link className="hotspot nav-music" href="/music" aria-label="Music" />
      <Link className="hotspot nav-videos" href="/videos" aria-label="Videos" />
      <Link className="hotspot nav-news" href="/news" aria-label="News" />
      <Link className="hotspot nav-merch" href="/merchandise" aria-label="Merchandise" />
      <Link className="hotspot nav-contact" href="/contact" aria-label="Contact" />
      <Link className="hotspot join-hotspot" href="/contact" aria-label="Join the journey" />
      <Link className="hotspot discover-hotspot" href="/artists" aria-label="Discover our artists" />
      <Link className="hotspot mission-hotspot" href="/about" aria-label="Our mission" />
      <Link className="hotspot release-hotspot" href="/music" aria-label="Latest release" />
      <Link className="hotspot journey-hotspot" href="/contact" aria-label="Join the journey" />
      <Link className="hotspot follow-hotspot" href="/contact" aria-label="Follow us" />
    </section>
  );
}
