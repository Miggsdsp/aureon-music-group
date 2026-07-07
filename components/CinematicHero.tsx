import Link from 'next/link';
import { ArrowDown, Instagram, Mail, Music2, Radio, Sparkles, Youtube } from 'lucide-react';

export function CinematicHero() {
  return (
    <section className="hero" aria-label="Aureon Music Group cinematic homepage">
      <div className="studio-bg" aria-hidden="true">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />

        <div className="studio-screen">
          <div className="screen-topline">AUREON // SPECTRUM ANALYZER</div>
          <div className="screen-grid" />
          <div className="graph graph-one" />
          <div className="graph graph-two" />
          <div className="meter-stack">
            {Array.from({ length: 12 }).map((_, i) => <span key={i} />)}
          </div>
        </div>

        <div className="rear-speaker speaker-a" />
        <div className="rear-speaker speaker-b" />

        <div className="desk">
          {Array.from({ length: 70 }).map((_, i) => <span key={i} className="desk-dot" />)}
          {Array.from({ length: 18 }).map((_, i) => <i key={i} className="desk-slider" />)}
        </div>

        <div className="keyboard">
          {Array.from({ length: 22 }).map((_, i) => <span key={i} />)}
        </div>

        <div className="producer-silhouette">
          <div className="head" />
          <div className="body" />
          <div className="arm arm-one" />
          <div className="arm arm-two" />
          <div className="hand hand-one" />
          <div className="hand hand-two" />
        </div>
      </div>

      <div className="hero-overlay" />

      <div className="hero-content">
        <div className="hero-mark" aria-hidden="true">A</div>
        <h1>AUREON</h1>
        <p className="hero-subtitle">Music Group</p>
        <p className="hero-tagline">Creating Tomorrow&apos;s Classics</p>
        <Link className="primary-button" href="/artists">Discover Our Artists <ArrowDown size={18} /></Link>
        <div className="scroll-cue" aria-hidden="true"><span />Scroll</div>
      </div>

      <div className="hero-bottom-panel">
        <article>
          <Sparkles />
          <div>
            <span>Our Mission</span>
            <p>Elevating music. Empowering artists. Creating legacies that inspire generations.</p>
            <Link href="/about">Learn more →</Link>
          </div>
        </article>
        <article>
          <Music2 />
          <div>
            <span>Latest Release</span>
            <p><strong>Solara</strong><br />Alive</p>
            <Link href="/music">Listen now →</Link>
          </div>
        </article>
        <article>
          <Mail />
          <div>
            <span>Join the Journey</span>
            <p>Be the first to hear about new music, artists and exclusive content.</p>
            <Link href="/contact">Sign up →</Link>
          </div>
        </article>
        <article>
          <Radio />
          <div>
            <span>Follow Us</span>
            <p className="social-row"><Youtube size={19} /> <Instagram size={18} /> Spotify • TikTok • Apple</p>
          </div>
        </article>
      </div>
    </section>
  );
}
