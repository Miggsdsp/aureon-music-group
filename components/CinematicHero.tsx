import Link from 'next/link';
import { ArrowDown, Mail, Music2, Radio, Sparkles } from 'lucide-react';

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
        </div>
        <div className="desk-lights">
          {Array.from({ length: 48 }).map((_, i) => <span key={i} />)}
        </div>
      </div>

      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-mark" aria-hidden="true">A</div>
        <h1>AUREON</h1>
        <p className="hero-subtitle">Music Group</p>
        <p className="hero-tagline">Creating Tomorrow&apos;s Classics</p>
        <Link className="primary-button" href="/artists">Discover Our Artists <ArrowDown size={16} /></Link>
        <div className="scroll-cue" aria-hidden="true"><span />Scroll</div>
      </div>

      <div className="hero-bottom-panel">
        <article>
          <Sparkles />
          <span>Our Mission</span>
          <p>Elevating music. Empowering artists. Creating legacies that inspire generations.</p>
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
        <article>
          <Radio />
          <span>Follow Us</span>
          <p>Spotify • YouTube • Instagram • TikTok • Apple</p>
        </article>
      </div>
    </section>
  );
}
