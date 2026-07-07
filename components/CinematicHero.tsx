import Link from 'next/link';
import { Play, ArrowDown, Music2, Mail, Instagram, Youtube } from 'lucide-react';

export function CinematicHero() {
  return (
    <section className="hero" aria-label="Aureon Music Group cinematic hero">
      <video className="hero-video" autoPlay muted loop playsInline poster="/images/aureon-studio-bg.jpg">
        <source src="/videos/aureon-hero.mp4" type="video/mp4" />
      </video>
      <div className="hero-poster" />
      <div className="studio-motion" aria-hidden="true">
        <div className="screen screen-one">
          <span className="screen-title">SPECTRUM ANALYZER</span>
          <i /><i /><i /><i /><i /><i />
          <b className="wave wave-a" /><b className="wave wave-b" />
        </div>
        <div className="meter-stack">
          {Array.from({ length: 9 }).map((_, i) => <span key={i} />)}
        </div>
        <div className="knob-field">
          {Array.from({ length: 12 }).map((_, i) => <span key={i} />)}
        </div>
        <div className="piano-glow">
          {Array.from({ length: 10 }).map((_, i) => <span key={i} />)}
        </div>
      </div>
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="a-mark">A</div>
        <p className="eyebrow">Independent Music Label</p>
        <h1>Creating Tomorrow&apos;s Classics</h1>
        <p className="hero-copy">
          Elevating music, empowering artists and creating legacies that inspire generations.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/artists">Discover Our Artists <ArrowDown size={16} /></Link>
          <Link className="ghost-button" href="/music"><Play size={16} /> Listen Now</Link>
        </div>
      </div>
      <div className="hero-bottom-panel">
        <article>
          <Music2 />
          <span>Our Mission</span>
          <p>Craft premium original music across genres with identity, emotion and commercial purpose.</p>
          <Link href="/licensing">Learn more →</Link>
        </article>
        <article>
          <img src="/images/solara-alive.jpg" alt="Solara Alive release artwork" />
          <span>Latest Release</span>
          <p><strong>Solara</strong><br />Alive</p>
          <Link href="/music">Listen now →</Link>
        </article>
        <article>
          <Mail />
          <span>Join the Journey</span>
          <p>Be first to hear about new artists, songs and exclusive Aureon updates.</p>
          <Link href="/contact">Sign up →</Link>
        </article>
        <article className="social-strip">
          <Instagram /><Youtube /><Music2 />
          <span>Follow Us</span>
          <p>Instagram • YouTube • TikTok • Spotify</p>
        </article>
      </div>
    </section>
  );
}
