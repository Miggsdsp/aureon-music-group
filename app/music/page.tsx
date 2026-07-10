import Image from 'next/image';
import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { albums } from '@/data/albums';

export default function MusicPage() {
  return (
    <PageShell title="Music" kicker="Catalogue">
      <section className="music-intro">
        <div>
          <p className="eyebrow">Aureon Catalogue</p>
          <h2>Albums and releases</h2>
        </div>
        <p>Browse Aureon albums, open a release, preview the available songs and purchase complete digital downloads.</p>
      </section>

      <section className="album-grid">
        {albums.map((album) => (
          <Link href={`/music/${album.slug}`} className="album-card" key={album.id}>
            <div className="album-cover">
              <Image
                src={album.cover}
                alt={`${album.title} album artwork`}
                width={900}
                height={900}
                unoptimized
              />
            </div>
            <div className="album-card-copy">
              <p>{album.id} · {album.year}</p>
              <h3>{album.title}</h3>
              <strong>{album.artist}</strong>
              <span>{album.genre}</span>
              <div className="album-meta"><Disc3 size={15} /> {album.songs.length} songs</div>
              <em>Open album →</em>
            </div>
          </Link>
        ))}
      </section>
    </PageShell>
  );
}
