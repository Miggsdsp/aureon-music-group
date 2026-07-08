import Link from 'next/link';
import { ArrowDown, Instagram, Mail, Music2, Radio, Sparkles, Youtube } from 'lucide-react';

export function CinematicHero() {
  return (
    <section className="hero cinematic-live-hero" aria-label="Aureon Music Group cinematic homepage">
      <div className="live-bg" aria-hidden="true" />
      <div className="live-vignette" aria-hidden="true" />
      <div className="light-sweep" aria-hidden="true" />

      <div className="live-analyzer" aria-hidden="true">
        <div className="analyzer-title">AUREON · SPECTRUM ANALYZER</div>
        <div className="analyzer-grid" />
        <svg className="wave wave-one" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path d="M0 78 C40 38 74 95 112 58 S190 42 230 70 S305 102 345 48 S420 22 468 64 S545 96 600 38" />
        </svg>
        <svg className="wave wave-two" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path d="M0 66 C44 85 82 24 132 70 S220 105 268 46 S350 22 400 72 S500 104 600 52" />
        </svg>
        <div className="eq-bars"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      </div>

      <div className="console-leds" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      <div className="dust-field" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>

      <div className="hero-content live-hero-content">
        <div className="hero-mark luxury-shimmer" aria-hidden="true">A</div>
        <h1 className="luxury-shimmer">AUREON</h1>
        <p className="hero-subtitle">Music Group</p>
        <p className="hero-tagline">Creating Tomorrow&apos;s Classics</p>
        <Link className="primary-button live-primary" href="/artists">Discover Our Artists <ArrowDown size={18} /></Link>
        <div className="scroll-cue" aria-hidden="true"><span />Scroll</div>
      </div>

      <div className="hero-bottom-panel live-bottom-panel">
        <article><Sparkles /><div><span>Our Mission</span><p>Elevating music. Empowering artists. Creating legacies that inspire generations.</p><Link href="/about">Learn more →</Link></div></article>
        <article><Music2 /><div><span>Latest Release</span><p><strong>Solara</strong><br />Alive</p><Link href="/music">Listen now →</Link></div></article>
        <article><Mail /><div><span>Join the Journey</span><p>Be the first to hear about new music, artists and exclusive content.</p><Link href="/contact">Sign up →</Link></div></article>
        <article><Radio /><div><span>Follow Us</span><p className="social-row"><Youtube size={19} /> <Instagram size={18} /> Spotify • YouTube • Instagram • Apple</p></div></article>
      </div>
    </section>
  );
}
