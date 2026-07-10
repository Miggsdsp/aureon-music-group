import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ListMusic } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { albums, getAlbumBySlug, getSongAudioPath } from '@/data/albums';

export const dynamicParams = false;

type AlbumPageParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return albums.map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({ params }: { params: AlbumPageParams }) {
  const { slug } = await params;
  const album = getAlbumBySlug(slug);

  if (!album) return { title: 'Album | Aureon Music Group' };

  return {
    title: `${album.title} | ${album.artist} | Aureon Music Group`,
    description: album.description
  };
}

export default async function AlbumPage({ params }: { params: AlbumPageParams }) {
  const { slug } = await params;
  const album = getAlbumBySlug(slug);

  if (!album) notFound();

  return (
    <main className="page-shell album-detail-page">
      <Header />

      <section className="album-hero-detail">
        <div className="album-detail-cover">
          <Image src={album.cover} alt={`${album.title} album artwork`} width={1000} height={1000} unoptimized />
        </div>

        <div className="album-detail-copy">
          <Link href="/music" className="back-link"><ArrowLeft size={16} /> Back to albums</Link>
          <p className="eyebrow">{album.id} · {album.genre} · {album.year}</p>
          <h1>{album.title}</h1>
          <h2>{album.artist}</h2>
          <p>{album.description}</p>
          <Link className="ghost-button" href={`/artists/${album.artistSlug}`}>View artist profile →</Link>
        </div>
      </section>

      <section className="album-track-section">
        <div className="album-track-heading">
          <ListMusic />
          <div>
            <p className="eyebrow">Track List</p>
            <h2>Songs in this album</h2>
          </div>
        </div>

        <div className="track-list">
          {album.songs.map((song, index) => (
            <article className="track-row" key={song.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{song.title}</h3>
                <p>{album.artist} · {song.duration} · Digital download €0.99</p>
              </div>
              <LatestPlayButton
                title={song.title}
                src={getSongAudioPath(album, song)}
                purchase={{
                  id: `${album.slug}-${song.file.replace('.mp3', '')}`,
                  title: song.title,
                  artist: album.artist,
                  image: album.cover,
                  price: 0.99,
                  promotional: false
                }}
              />
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
