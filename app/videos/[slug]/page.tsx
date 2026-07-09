import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clapperboard, Film, Play } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getVideoAlbumBySlug, getVideoPath, videoAlbums } from '@/data/videoAlbums';

export const dynamicParams = false;

type VideoAlbumPageParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return videoAlbums.map((album) => ({ slug: album.slug }));
}

export async function generateMetadata({ params }: { params: VideoAlbumPageParams }) {
  const { slug } = await params;
  const album = getVideoAlbumBySlug(slug);

  if (!album) return { title: 'Video Album | Aureon Music Group' };

  return {
    title: `${album.title} Videos | ${album.artist} | Aureon Music Group`,
    description: album.description
  };
}

export default async function VideoAlbumPage({ params }: { params: VideoAlbumPageParams }) {
  const { slug } = await params;
  const album = getVideoAlbumBySlug(slug);

  if (!album) notFound();

  return (
    <main className="page-shell video-detail-page">
      <Header />

      <section className="album-hero-detail video-hero-detail">
        <div className="album-detail-cover video-detail-cover">
          <Image
            src={album.cover}
            alt={`${album.title} video album artwork`}
            width={1000}
            height={1000}
            unoptimized
          />
          <div className="video-play-mark large"><Film size={40} /></div>
        </div>

        <div className="album-detail-copy">
          <Link href="/videos" className="back-link"><ArrowLeft size={16} /> Back to video albums</Link>
          <p className="eyebrow">{album.id} · {album.genre} · {album.year}</p>
          <h1>{album.title}</h1>
          <h2>{album.artist}</h2>
          <p>{album.description}</p>
          <Link className="ghost-button" href={`/artists/${album.artistSlug}`}>View artist profile →</Link>
        </div>
      </section>

      <section className="album-track-section video-list-section">
        <div className="album-track-heading">
          <Clapperboard />
          <div>
            <p className="eyebrow">Video List</p>
            <h2>Videos in this album</h2>
          </div>
        </div>

        <div className="video-list-grid">
          {album.videos.map((video, index) => (
            <article className="video-row-card" key={video.title}>
              <div className="video-placeholder">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Play size={34} />
                <video src={getVideoPath(album, video)} controls preload="none" />
              </div>
              <div>
                <p className="eyebrow">{video.type} · {video.duration}</p>
                <h3>{video.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
