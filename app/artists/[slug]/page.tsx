import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Music2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { artists, getArtistAudioPath, getArtistBySlug } from '@/data/artists';

export const dynamicParams = false;

type ArtistPageParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return artists.map((artist) => ({ slug: artist.slug }));
}

export async function generateMetadata({ params }: { params: ArtistPageParams }) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    return { title: 'Artist | Aureon Music Group' };
  }

  return {
    title: `${artist.name} | Aureon Music Group`,
    description: artist.desc
  };
}

export default async function ArtistProfilePage({ params }: { params: ArtistPageParams }) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) notFound();

  return (
    <main className="page-shell artist-profile-page">
      <Header />

      <section className={`artist-profile-hero artist-${artist.slug}`}>
        <div className="artist-profile-logo-wrap">
          <Image
            src={`/images/artists/${artist.slug}/${artist.logo}`}
            alt={`${artist.name} logo`}
            width={1000}
            height={1000}
            unoptimized
            className="artist-profile-logo"
          />
        </div>

        <div className="artist-profile-copy">
          <Link href="/artists" className="back-link"><ArrowLeft size={16} /> Back to artists</Link>
          <p className="eyebrow">{artist.id} · {artist.genre}</p>
          <h1>{artist.name}</h1>
          <p className="artist-profile-desc">{artist.bio}</p>
          <LatestPlayButton title={artist.latest} src={getArtistAudioPath(artist)} />
        </div>
      </section>

      <section className="artist-profile-panel">
        <div>
          <p className="eyebrow">Sound Identity</p>
          <h2>{artist.name} sound profile</h2>
          <p>{artist.desc}</p>
        </div>

        <div className="artist-sound-list">
          {artist.sound.map((item) => (
            <article key={item}>
              <Music2 size={20} />
              <span>{item}</span>
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
