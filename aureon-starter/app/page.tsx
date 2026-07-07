const artists = [
  { name: 'Solara', genre: 'Deep House', tone: 'Cinematic Piano • Ibiza Energy', copy: 'Emotional piano-led electronic music built for sunset playlists, premium lounges and timeless club moments.' },
  { name: 'Ryder Blackwood', genre: 'Western Pop / Country', tone: 'Deep Voice • Ranch Stories', copy: 'Modern country storytelling with crossover pop hooks, campfire emotion and cinematic grit.' },
  { name: 'Ganja Boy', genre: 'Reggae', tone: 'Roots Groove • Calm Spirit', copy: 'Warm reggae rhythms, freedom energy and uplifting choruses that release tension and touch the heart.' },
  { name: 'Ash Cadwell', genre: 'Blues', tone: 'Smoke • Whiskey • Soul', copy: 'Smoky vocals, whiskey-soaked guitars and soul-heavy stories for late-night listeners.' },
  { name: 'Zenara', genre: 'Afro House', tone: 'Spiritual Rhythm • Luxury Movement', copy: 'Premium Afro House rhythms, spiritual melodies and movement-driven energy for global dance floors.' }
];

const releases = [
  { title: 'Life Is For Living', artist: 'Solara', status: 'Flagship Single' },
  { title: 'Under The Texan Sky', artist: 'Ryder Blackwood', status: 'In Production' },
  { title: 'Love For The Herb', artist: 'Ganja Boy', status: 'In Production' }
];

export default function Home() {
  return (
    <main>
      <div className="video-bg">
        <video autoPlay muted loop playsInline poster="/images/video-poster.jpg">
          <source src="/videos/studio-loop.mp4" type="video/mp4" />
        </video>
      </div>
      <div className="overlay" />
      <div className="noise" />

      <nav className="nav">
        <a href="#home" className="brand" aria-label="Aureon Music Group home">
          <img src="/images/aureon-mark.svg" alt="" />
          <span>AUREON</span>
        </a>
        <div className="nav-links">
          <a href="#artists">Artists</a>
          <a href="#music">Music</a>
          <a href="#licensing">Licensing</a>
          <a href="#shop">Store</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <section id="home" className="hero">
        <div className="hero-inner">
          <img className="hero-logo" src="/images/aureon-logo.svg" alt="Aureon Music Group" />
          <div className="kicker">Independent Music Label</div>
          <h1>Creating Tomorrow&apos;s Classics</h1>
          <p>
            A premium independent label crafting original music with identity, emotion and long-term commercial value.
          </p>
          <div className="btn-row">
            <a className="btn primary" href="#music">Listen Now</a>
            <a className="btn" href="#artists">Meet The Artists</a>
          </div>
        </div>
      </section>

      <section id="artists" className="section">
        <div className="section-heading">
          <div className="kicker">Official Roster</div>
          <h2>Five worlds. One label.</h2>
          <p>Each Aureon artist has a defined sound, visual identity and audience pathway.</p>
        </div>
        <div className="grid artists-grid">
          {artists.map((artist) => (
            <article className="artist-card" key={artist.name}>
              <div className="genre">{artist.genre}</div>
              <h3>{artist.name}</h3>
              <span>{artist.tone}</span>
              <p>{artist.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="music" className="section split">
        <div>
          <div className="kicker">Release Pipeline</div>
          <h2>Built to release with purpose.</h2>
          <p>
            Every song will have artwork, social clips, streaming links, video assets and a clear commercial role before release day.
          </p>
          <div className="btn-row left">
            <a className="btn primary" href="#shop">Buy Downloads</a>
            <a className="btn" href="#licensing">License Music</a>
          </div>
        </div>
        <div className="panel release-list">
          {releases.map((release) => (
            <div className="release" key={release.title}>
              <div>
                <strong>{release.artist}</strong>
                <span>{release.title}</span>
              </div>
              <em>{release.status}</em>
            </div>
          ))}
        </div>
      </section>

      <section id="licensing" className="section split">
        <div className="panel gold-panel">
          <div className="kicker">Sync & Licensing</div>
          <h2>Music for film, adverts, games and creators.</h2>
          <p>
            Aureon Music Group offers original tracks for commercials, content creators, podcasts, film, TV, gaming and brand campaigns.
          </p>
        </div>
        <div className="panel">
          <h3>Licensing enquiries</h3>
          <p>Email us with the song, usage type, territory, duration and project details.</p>
          <a className="btn primary" href="mailto:info@aureonmusicgroup.com">info@aureonmusicgroup.com</a>
        </div>
      </section>

      <section id="shop" className="section store-panel">
        <div className="kicker">Direct Store</div>
        <h2>Downloads, merch and fan access coming soon.</h2>
        <p>
          Aureon will sell direct downloads, merchandise and future fan memberships from this platform.
        </p>
      </section>

      <section id="contact" className="section split">
        <div>
          <div className="kicker">Contact</div>
          <h2>Build the sound of Aureon.</h2>
          <p>For music, licensing, partnerships or artist enquiries, contact the label directly.</p>
        </div>
        <div className="panel contact-card">
          <p><strong>Email:</strong> info@aureonmusicgroup.com</p>
          <p><strong>Website:</strong> www.aureonmusicgroup.com</p>
          <p><strong>Tagline:</strong> Creating Tomorrow&apos;s Classics</p>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Aureon Music Group</span>
        <span>Creating Tomorrow&apos;s Classics</span>
      </footer>
    </main>
  );
}
