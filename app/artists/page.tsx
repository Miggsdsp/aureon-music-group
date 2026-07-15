'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type ArtistRecord = PublicRecord & {
  name: string;
  slug: string;
  genre?: string;
  description?: string;
  logoUrl?: string;
  profileImageUrl?: string;
};

export default function ArtistsPage() {
  const { items: artists, loading } = usePublishedCollection<ArtistRecord>('artists', []);

  return (
    <PageShell title="Our Artists" kicker="The Sound of Tomorrow">
      <div className="artists-intro">
        <p>A diverse collective of world-class identities. Each Aureon artist has their own logo, sound, story and market lane.</p>
        <Link className="primary-button" href="/music">Explore all music →</Link>
      </div>

      {loading ? <div className="store-empty"><h3>Loading artists…</h3></div> : artists.length ? (
        <div className="artist-grid page-grid artist-identity-grid">
          {artists.map((artist) => {
            const logoSrc = artist.logoUrl || artist.profileImageUrl || '/images/branding/Aureon_Header_Logo.png';
            return (
              <article className={`artist-card identity-card logo-card artist-${artist.slug}`} key={artist.id}>
                <div className="artist-logo-frame">
                  <Image src={logoSrc} alt={`${artist.name} logo`} width={900} height={900} unoptimized className="artist-uploaded-logo" />
                </div>
                <p>{artist.id}</p>
                <h3>{artist.name}</h3>
                <strong>{artist.genre || 'Aureon Artist'}</strong>
                <span>{artist.description || ''}</span>
                <Link href={`/artists/${artist.slug}`}>View artist →</Link>
              </article>
            );
          })}
        </div>
      ) : <div className="store-empty"><h3>No published artists yet</h3><p>Publish artists in the Aureon Control Center to display them here.</p></div>}

      <div className="discover-strip">
        <Headphones />
        <div><h3>Discover their music</h3><p>Preview releases or buy the full digital download.</p></div>
        <Link className="ghost-button" href="/music">Browse all music →</Link>
      </div>
    </PageShell>
  );
}
