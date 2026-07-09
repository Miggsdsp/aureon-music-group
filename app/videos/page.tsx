import Image from 'next/image';
import Link from 'next/link';
import { Clapperboard, Film } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { videoAlbums } from '@/data/videoAlbums';

export default function VideosPage() {
  return (
    <PageShell title="Videos" kicker="Visual World">
      <section className="music-intro video-intro">
        <div>
          <p className="eyebrow">Aureon Visual Catalogue</p>
          <h2>Video albums and visual releases</h2>
        </div>
        <p>Browse Aureon video albums, open a release, then view the music videos, lyric videos and visualizers inside that album.</p>
      </section>

      <section className="album-grid video-album-grid">
        {videoAlbums.map((album) => (
          <Link href={`/videos/${album.slug}`} className="album-card video-album-card" key={album.id}>
            <div className="album-cover video-cover">
              <Image
                src={album.cover}
                alt={`${album.title} video album artwork`}
                width={900}
                height={900}
                unoptimized
              />
              <div className="video-play-mark"><Film size={28} /></div>
            </div>
            <div className="album-card-copy">
              <p>{album.id} · {album.year}</p>
              <h3>{album.title}</h3>
              <strong>{album.artist}</strong>
              <span>{album.genre}</span>
              <div className="album-meta"><Clapperboard size={15} /> {album.videos.length} videos</div>
              <em>Open video album →</em>
            </div>
          </Link>
        ))}
      </section>
    </PageShell>
  );
}
