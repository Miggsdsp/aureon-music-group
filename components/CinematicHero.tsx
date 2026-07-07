import Link from 'next/link';
import { ArrowDown, Mail, Music2, Play, Radio, Sparkles } from 'lucide-react';

export function CinematicHero() {
  return (
    <section className="hero" aria-label="Aureon Music Group cinematic homepage">
      <div className="studio-bg" aria-hidden="true">
        <div className="studio-screen">
          <span>SPECTRUM ANALYZER</span>
          <div className="graph graph-one" />
          <div className="graph graph-two" />
          <div className="graph-grid" />
        </div>
        <div className="producer-silhouette">
          <div className="head" />
          <div className="body" />
          <div className="arm arm-one" />
          <div className="arm arm-two" />
          <div className="hand hand-one" />
          <div className="hand hand-two" />
        </div>
        <div className="mixing-desk">
          {Array.from({ length: 42 }).map((_, i) => <span key={`dial-${i}`} className="dial" />)}
          {Array.from({ length: 26 }).map((_, i) => <i key={`fader-${i}`} className="fader" />)}
        </div>
        <div className="keyboard">
          {Array.from({ length: 18 }).map((_, i) => <span key={`key-${i}`} />)}
        </div>
        <div className="speaker speaker-left" />
        <div className="speaker speaker-right" />
      </div>

      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-mark" aria-hidden="true">A</div>
        <h1>AUREON</h1>
        <p className="hero-subtitle">Music Group</p>
        <p className="hero-tagline">Creating Tomorrow&apos;s Classics</p>
        <div className="hero-actions">
          <Link className="primary-button" href="/artists">Discover Our Artists <ArrowDown size={15} /></Link>
          <Link className="ghost-button" href="/music"><Play size={15} /> Listen Now</Link>
        </div>
        <div className="scroll-cue" aria-hidden="true"><span />Scroll</div>
      </div>

      <div className="hero-bottom-panel">
        <article>
          <Sparkles />
          <span>Our Mission</span>
          <p>Elevating music, empowering artists and creating legacies that inspire generations.</p>
          <Link href="/about">Learn more →</Link>
        </article>
        <article>
          <Music2 />
          <span>Latest Release</span>
          <p><strong>Solara</strong><br />Alive</p>
          <Link href="/music">Listen now →</Link>
        </article>
        <article>
          <Mail />
          <span>Join the Journey</span>
          <p>Be the first to hear about new music, artists and exclusive content.</p>
          <Link href="/contact">Sign up →</Link>
        </article>
        <article className="social-strip">
          <Radio />
          <span>Follow Us</span>
          <p>Spotify • YouTube • Instagram • TikTok • Apple</p>
        </article>
      </div>
    </section>
  );
}
