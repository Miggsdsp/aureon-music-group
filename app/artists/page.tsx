import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

const artists = [
  { id: 'ART001', name: 'KAIVO', genre: 'House / Ibiza', logo: 'orbit', desc: 'Bright island house with elegant club energy and cinematic sunset melodies.' },
  { id: 'ART002', name: 'MAREA', genre: 'Portuguese', logo: 'crest', desc: 'Portuguese emotion, ocean warmth and timeless melodic storytelling.' },
  { id: 'ART003', name: 'SOLENTO', genre: 'Latin', logo: 'sun', desc: 'Latin heat, romance and rhythmic hooks built for global playlists.' },
  { id: 'ART004', name: 'NURU', genre: 'Afro House', logo: 'mask', desc: 'Deep Afro House rhythm, ancestral warmth and premium dance-floor power.' },
  { id: 'ART005', name: 'EONIX', genre: 'Trance', logo: 'eclipse', desc: 'Futuristic trance with neon emotion and wide cinematic lifts.' },
  { id: 'ART006', name: 'BLACKWOOD', genre: 'Country Pop', logo: 'guitar', desc: 'Modern country-pop stories with ranch soul, faith and big choruses.' },
  { id: 'ART007', name: 'GANJA BOY', genre: 'Reggae', logo: 'lion', desc: 'Authentic reggae calm, herb culture, soul and peaceful release.' },
  { id: 'ART008', name: 'ASH CALDWELL', genre: 'Blues', logo: 'badge', desc: 'Whiskey-toned blues, late-night guitar and lived-in storytelling.' },
  { id: 'ART009', name: 'STARLIGHT', genre: "80's - 90's Pop", logo: 'star', desc: 'Retro pop glow, nostalgic hooks and radio-ready sparkle.' },
  { id: 'ART010', name: 'EVERSTONE', genre: 'Soft Rock', logo: 'mountain', desc: 'Emotional soft rock with big melodies and timeless heart.' }
];

function ArtistLogo({ type, name }: { type: string; name: string }) {
  return <div className={`artist-logo artist-logo-${type}`}><span>{name}</span></div>;
}

export default function ArtistsPage() {
  return (
    <PageShell title="Our Artists" kicker="The Sound of Tomorrow">
      <div className="artists-intro">
        <p>A diverse collective of world-class identities. Each Aureon artist has their own logo, sound, story and market lane.</p>
        <Link className="primary-button" href="/music">Explore all music →</Link>
      </div>

      <div className="artist-grid page-grid artist-identity-grid">
        {artists.map((artist) => (
          <article className="artist-card identity-card" key={artist.id}>
            <ArtistLogo type={artist.logo} name={artist.name} />
            <p>{artist.id}</p>
            <h3>{artist.name}</h3>
            <strong>{artist.genre}</strong>
            <span>{artist.desc}</span>
            <Link href={`/artists/${artist.name.toLowerCase().replaceAll(' ', '-')}`}>View artist →</Link>
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
