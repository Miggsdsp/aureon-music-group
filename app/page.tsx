import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { Footer } from '@/components/Footer';

const artists = [
  ['Solara', 'Deep House', 'Emotional piano hooks and sunset electronic energy.'],
  ['Ryder Blackwood', 'Western Pop / Country', 'Hard-working stories, campfire soul and crossover melodies.'],
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
        <p className="eyebrow">Artist Universe</p>
        <h2>Five sounds. One premium label.</h2>
        <div className="artist-grid">
          {artists.map(([name, genre, desc]) => (
            <article key={name} className="artist-card">
              <div className="artist-glow" />
              <p>{genre}</p>
              <h3>{name}</h3>
              <span>{desc}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="section split-section">
        <div>
          <p className="eyebrow">Licensing</p>
          <h2>Music built for listeners, brands and screens.</h2>
        </div>
        <p>
          Aureon is designed from day one for streaming, digital downloads, sync licensing,
          visual content and long-term catalogue value.
        </p>
      </section>
      <Footer />
    </main>
  );
}
