const artists = [
  { name: 'Solara', genre: 'Deep House', copy: 'Emotional piano-led electronic music built for sunset playlists and timeless club moments.' },
  { name: 'Ryder Blackwood', genre: 'Western Pop / Country', copy: 'Modern country storytelling with crossover pop hooks and cinematic grit.' },
  { name: 'Ganja Boy', genre: 'Reggae', copy: 'Warm roots grooves, freedom energy and uplifting choruses with global appeal.' },
  { name: 'Ash Cadwell', genre: 'Blues', copy: 'Smoky vocals, whiskey-soaked guitars and soul-heavy stories.' },
  { name: 'Zenara', genre: 'Afro House', copy: 'Premium Afro House rhythms, spiritual melodies and movement-driven energy.' }
];

const tracks = [
  { title: 'Solara — Life Is For Living', price: '€0.99' },
  { title: 'Ryder Blackwood — Dust On The Road', price: '€0.99' },
  { title: 'Zenara — Rise With The Sun', price: '€0.99' }
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
        <a href="#home" className="logo">AUREON</a>
        <div className="nav-links">
          <a href="#artists">Artists</a>
          <a href="#music">Music</a>
          <a href="#licensing">Licensing</a>
          <a href="#shop">Shop</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <section id="home" className="hero">
        <div>
          <div className="kicker">Aureon Music Group</div>
          <h1>Creating Tomorrow&apos;s Classics</h1>
          <p>
            An independent music label crafting original music across deep house, western pop, reggae, blues and Afro house.
          </p>
          <div className="btn-row">
            <a className="btn primary" href="#music">Listen Now</a>
            <a className="btn" href="#artists">Meet The Artists</a>
          </div>
        </div>
      </section>

      <section id="artists" className="section">
        <div className="kicker">Official Roster</div>
        <h2>Five worlds. One label.</h2>
        <div className="grid">
          {artists.map((artist) => (
            <article className="card" key={artist.name}>
              <div className="genre">{artist.genre}</div>
              <h3>{artist.name}</h3>
              <p>{artist.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="music" className="section split">
        <div>
          <div className="kicker">New Releases</div>
          <h2>Music made to move people.</h2>
          <p>
            This section will connect to Spotify, Apple Music, YouTube Music and direct downloads as each single goes live.
          </p>
          <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
            <a className="btn primary" href="#shop">Buy Downloads</a>
            <a className="btn" href="https://www.youtube.com" target="_blank">YouTube</a>
          </div>
        </div>
        <div className="panel track-list">
          {tracks.map((track) => (
            <div className="track" key={track.title}>
              <span>{track.title}</span>
              <span className="price">{track.price}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="licensing" className="section split">
        <div className="panel">
          <div className="kicker">Sync & Licensing</div>
          <h2>Music for film, adverts and creators.</h2>
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

      <section id="shop" className="section">
        <div className="kicker">Store</div>
        <h2>Direct downloads coming soon.</h2>
        <p>
          Add Stripe, Shopify Buy Buttons, Lemon Squeezy or Gumroad here when you are ready to sell tracks for €0.99.
        </p>
      </section>

      <section id="contact" className="section split">
        <div>
          <div className="kicker">Contact</div>
          <h2>Let&apos;s build the sound of Aureon.</h2>
          <p>For music, licensing, partnerships or artist enquiries, contact the label directly.</p>
        </div>
        <div className="panel">
          <p><strong>Email:</strong> info@aureonmusicgroup.com</p>
          <p><strong>Website:</strong> www.aureonmusicgroup.com</p>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Aureon Music Group</span>
        <span>Independent music label</span>
      </footer>
    </main>
  );
}
