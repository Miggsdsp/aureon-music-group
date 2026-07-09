import Image from 'next/image';
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { artists, getArtistAudioPath } from '@/data/artists';

export default function ArtistsPage() {
  return (
    <PageShell title="Our Artists" kicker="The Sound of Tomorrow">
      <div className="artists-intro">
        <p>A diverse collective of world-class identities. Each Aureon artist has their own logo, sound, story and market lane.</p>
        <Link className="primary-button" href="/music">Explore all music →</Link>
      </div>

      <div className="artist-grid page-grid artist-identity-grid">
        {artists.map((artist) => (
          <article className={`artist-card identity-card logo-card artist-${artist.slug}`} key={artist.id}>
            <div className="artist-logo-frame">
              <Image
                src={`/images/artists/${artist.slug}/${artist.logo}`}
                alt={`${artist.name} logo`}
                width={900}
                height={900}
                unoptimized
                className="artist-uploaded-logo"
              />
            </div>
            <p>{artist.id}</p>
            <h3>{artist.name}</h3>
            <strong>{artist.genre}</strong>
            <span>{artist.desc}</span>
            <LatestPlayButton title={artist.latest} src={getArtistAudioPath(artist)} />
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
