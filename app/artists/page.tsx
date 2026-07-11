'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { artists as fallbackArtists, getArtistAudioPath } from '@/data/artists';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type ArtistRecord = PublicRecord & {
  name: string;
  slug: string;
  genre?: string;
  desc?: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
  latest?: string;
  latestFile?: string;
  latestAudioUrl?: string;
};

const fallback = fallbackArtists.map((artist) => ({ ...artist, id: artist.id } as ArtistRecord));

export default function ArtistsPage() {
  const { items: artists } = usePublishedCollection<ArtistRecord>('artists', fallback);

  return (
    <PageShell title="Our Artists" kicker="The Sound of Tomorrow">
      <div className="artists-intro">
        <p>A diverse collective of world-class identities. Each Aureon artist has their own logo, sound, story and market lane.</p>
        <Link className="primary-button" href="/music">Explore all music →</Link>
      </div>

      <div className="artist-grid page-grid artist-identity-grid">
        {artists.map((artist) => {
          const logoSrc = artist.logoUrl || (artist.logo ? `/images/artists/${artist.slug}/${artist.logo}` : '/images/branding/Aureon_Header_Logo.png');
          const latestTitle = artist.latest || 'Latest release';
          const latestSrc = artist.latestAudioUrl || (artist.latestFile ? getArtistAudioPath(artist as never) : '');
          return (
            <article className={`artist-card identity-card logo-card artist-${artist.slug}`} key={artist.id}>
              <div className="artist-logo-frame">
                <Image src={logoSrc} alt={`${artist.name} logo`} width={900} height={900} unoptimized className="artist-uploaded-logo" />
              </div>
              <p>{artist.id}</p>
              <h3>{artist.name}</h3>
              <strong>{artist.genre || 'Aureon Artist'}</strong>
              <span>{artist.description || artist.desc || ''}</span>
              {latestSrc ? <LatestPlayButton title={latestTitle} src={latestSrc} purchase={{ id: `${artist.slug}-${artist.id}`, title: latestTitle, artist: artist.name, image: logoSrc, price: 0.99, promotional: false }} /> : null}
              <Link href={`/artists/${artist.slug}`}>View artist →</Link>
            </article>
          );
        })}
      </div>

      <div className="discover-strip">
        <Headphones />
        <div><h3>Discover their music</h3><p>Preview releases or buy the full digital download.</p></div>
        <Link className="ghost-button" href="/music">Browse all music →</Link>
      </div>
    </PageShell>
  );
}
