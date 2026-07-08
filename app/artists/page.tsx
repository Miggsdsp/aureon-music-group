import Image from 'next/image';
import Link from 'next/link';
import { Headphones, Play } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const artists = [
  { id: 'ART001', name: 'KAIVO', slug: 'kaivo', genre: 'House / Ibiza', latest: 'Galactic', desc: 'Bright island house with elegant club energy and cinematic sunset melodies.' },
  { id: 'ART002', name: 'MAREA', slug: 'marea', genre: 'Portuguese', latest: 'Eterno Capitão', desc: 'Portuguese emotion, ocean warmth and timeless melodic storytelling.' },
  { id: 'ART003', name: 'SOLENTO', slug: 'solento', genre: 'Latin', latest: 'Sol De Amor', desc: 'Latin heat, romance and rhythmic hooks built for global playlists.' },
  { id: 'ART004', name: 'NURU', slug: 'nuru', genre: 'Afro House', latest: 'Rise To Power', desc: 'Deep Afro House rhythm, ancestral warmth and premium dance-floor power.' },
  { id: 'ART005', name: 'EONIX', slug: 'eonix', genre: 'Trance', latest: 'Beyond The Light', desc: 'Futuristic trance with neon emotion and wide cinematic lifts.' },
  { id: 'ART006', name: 'RYDER BLACKWOOD', slug: 'ryder-blackwood', genre: 'Country Pop', latest: 'Under The Texan Sky', desc: 'Modern country-pop stories with ranch soul, faith and big choruses.' },
  { id: 'ART007', name: 'GANJA BOY', slug: 'gunjaboy', genre: 'Reggae', latest: 'Love For The Herb', desc: 'Authentic reggae calm, herb culture, soul and peaceful release.' },
  { id: 'ART008', name: 'ASH CALDWELL', slug: 'ash-caldwell', genre: 'Blues', latest: 'Midnight Bottle', desc: 'Whiskey-toned blues, late-night guitar and lived-in storytelling.' },
  { id: 'ART009', name: 'STARLIGHT', slug: 'starlight', genre: "80's - 90's Pop", latest: 'Neon Forever', desc: 'Retro pop glow, nostalgic hooks and radio-ready sparkle.' },
  { id: 'ART010', name: 'EVERSTONE', slug: 'everstone', genre: 'Soft Rock', latest: 'Hold On Tonight', desc: 'Emotional soft rock with big melodies and timeless heart.' }
];

export default function ArtistsPage() {
  return (
    <PageShell title="Our Artists" kicker="The Sound of Tomorrow">
      <div className="artists-intro">
        <p>A diverse collective of world-class identities. Each Aureon artist has their own logo, sound, story and market lane.</p>
        <Link className="primary-button" href="/music">Explore all music →</Link>
      </div>

      <div className="artist-grid page-grid artist-identity-grid">
        {artists.map((artist) => (
          <article className="artist-card identity-card logo-card" key={artist.id}>
            <div className="artist-logo-frame">
              <Image src={`/images/artists/${artist.slug}/logo.png`} alt={`${artist.name} logo`} width={520} height={520} className="artist-uploaded-logo" />
            </div>
            <p>{artist.id}</p>
            <h3>{artist.name}</h3>
            <strong>{artist.genre}</strong>
            <span>{artist.desc}</span>
            <div className="latest-release"><Play size={13} /> Latest: {artist.latest}</div>
            <Link href={`/artists/${artist.slug}`}>View artist →</Link>
          </article>
        ))}
      </div>

      <div className="discover-strip">
        <Headphones />
        <div>
          <h3>Discover their music</h3>
          <p>Stream the latest releases from the Aureon roster.</p>
        </div>
        <Link className="ghost-button" href="/music">Browse all music →</Link>
      </div>
    </PageShell>
  );
}
