import Link from 'next/link';
import { Disc3, Globe2, Headphones, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const pillars = [
  {
    icon: Sparkles,
    title: 'Distinct Artist Worlds',
    text: 'Every Aureon artist is developed as a complete creative identity with an individual sound, visual language, story and audience.'
  },
  {
    icon: Disc3,
    title: 'Premium Releases',
    text: 'Every single, album and video is presented as an event with strong artwork, storytelling and a polished release experience.'
  },
  {
    icon: Globe2,
    title: 'Global Reach',
    text: 'Aureon is being built for worldwide discovery across streaming platforms, direct sales, social media, video and licensing.'
  },
  {
    icon: ShieldCheck,
    title: 'Long-Term Ownership',
    text: 'We focus on building valuable catalogues, protecting intellectual property and creating sustainable revenue around every release.'
  }
];

const journey = [
  ['01', 'Create', 'Develop original songs, identities, visual concepts and artist worlds.'],
  ['02', 'Release', 'Publish music and video through a premium, coordinated launch strategy.'],
  ['03', 'Connect', 'Build direct relationships between artists, listeners and fans worldwide.'],
  ['04', 'Grow', 'Expand through streaming, direct sales, merchandise, licensing and future experiences.']
];

export const metadata = {
  title: 'About Aureon Music Group',
  description: 'Learn about Aureon Music Group, its artists, mission and vision for building tomorrow’s classics.'
};

export default function AboutPage() {
  return (
    <main className="page-shell about-page">
      <Header />

      <section className="about-hero about-hero-clean">
        <div className="about-hero-copy">
          <p className="eyebrow">Independent Music. Global Ambition.</p>
          <h1>Creating tomorrow&apos;s classics.</h1>
          <p>
            Aureon Music Group is a modern independent music company built to create memorable artists,
            premium releases and lasting musical catalogues across multiple genres.
          </p>
          <div className="about-hero-actions">
            <Link href="/artists" className="primary-button">Meet our artists →</Link>
            <Link href="/music" className="ghost-button">Explore the music →</Link>
          </div>
        </div>
      </section>

      <section className="about-story-section">
        <div className="about-section-label">
          <p className="eyebrow">Our Story</p>
          <span>Built for artists. Designed for the future.</span>
        </div>
        <div className="about-story-copy">
          <h2>A label where music, identity and ownership move together.</h2>
          <p>
            Aureon Music Group was created around a simple belief: music should not be treated as disposable content.
            Every artist deserves a recognisable identity, every song deserves a powerful presentation and every fan
            should be able to enter a complete creative world.
          </p>
          <p>
            Our roster spans electronic music, country, reggae, blues, rock, Portuguese music, Latin music and Afro House.
            The genres are different, but the standard is the same: meaningful music, memorable melodies and premium execution.
          </p>
        </div>
      </section>

      <section className="about-pillars-section">
        <div className="about-section-heading">
          <p className="eyebrow">The Aureon Standard</p>
          <h2>What defines the label</h2>
        </div>
        <div className="about-pillars-grid">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon size={28} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-mission-section">
        <div className="about-mission-card">
          <Headphones size={34} />
          <p className="eyebrow">Our Mission</p>
          <h2>Build music people return to for years, not days.</h2>
          <p>
            Our mission is to create artists and releases with emotional value, strong commercial potential and a long life beyond launch day.
          </p>
        </div>
        <div className="about-mission-card">
          <Users size={34} />
          <p className="eyebrow">Our Vision</p>
          <h2>A global independent label with a direct relationship to its audience.</h2>
          <p>
            We are building a connected ecosystem of music, video, stories, merchandise and fan experiences under one premium brand.
          </p>
        </div>
      </section>

      <section className="about-journey-section">
        <div className="about-section-heading">
          <p className="eyebrow">How We Build</p>
          <h2>From idea to lasting catalogue</h2>
        </div>
        <div className="about-journey-grid">
          {journey.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="about-final-cta">
        <div>
          <p className="eyebrow">Enter The Aureon World</p>
          <h2>Discover the artists shaping the next chapter.</h2>
        </div>
        <div>
          <Link href="/artists" className="primary-button">View all artists →</Link>
          <Link href="/contact" className="ghost-button">Contact Aureon →</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
