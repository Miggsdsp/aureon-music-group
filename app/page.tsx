import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />

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
