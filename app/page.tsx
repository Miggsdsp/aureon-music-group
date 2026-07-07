import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

const artists = [
  ['Solara', 'Deep House', 'Emotional piano hooks and sunset electronic energy.'],
  ['Ryder Blackwood', 'Western Pop / Country', 'Ranch-life stories, campfire soul and crossover melodies.'],
  ['Ganja Boy', 'Reggae', 'Warm grooves, calming herb culture and authentic island feeling.'],
  ['Ash Cadwell', 'Blues', 'Whiskey-toned vocals and timeless guitar-driven storytelling.'],
  ['Zenara', 'Afro House', 'Premium rhythm, African warmth and club-ready movement.']
];

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />

      <section id="artists" className="section artists-preview">
        <p className="eyebrow">Featured Artists</p>
        <h2>Five worlds. One label.</h2>
        <div className="artist-grid">
          {artists.map(([name, genre, desc]) => (
            <article key={name} className="artist-card">
              <div className="artist-glow" />
              <p>{genre}</p>
              <h3>{name}</h3>
              <span>{desc}</span>
              <Link href="/artists">Open profile →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div>
          <p className="eyebrow">The Aureon Standard</p>
          <h2>Every release must feel like a premium event.</h2>
        </div>
        <p>
          Aureon Music Group is being built as a modern independent label: cinematic presentation,
          artist identity, music catalogue value, direct downloads, social campaigns and licensing.
        </p>
      </section>

      <section className="section journey-section">
        <div>
          <p className="eyebrow">Next Step</p>
          <h2>Build the catalogue, grow the audience, own the fan relationship.</h2>
        </div>
        <div className="journey-cards">
          <article><span>01</span><h3>Release</h3><p>Launch flagship singles with strong artwork, video and story.</p></article>
          <article><span>02</span><h3>Promote</h3><p>Turn every song into short-form video, playlists and fan engagement.</p></article>
          <article><span>03</span><h3>Monetise</h3><p>Streaming, downloads, merchandise, licensing and future membership.</p></article>
        </div>
      </section>

      <Footer />
    </main>
  );
}
