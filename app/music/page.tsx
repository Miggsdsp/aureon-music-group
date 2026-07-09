import Image from 'next/image';
import Link from 'next/link';
import { Disc3, Music2 } from 'lucide-react';
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
        <p>Browse Aureon albums, open a release, then play the available songs inside that album.</p>
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

      <section className="music-note-strip">
        <Music2 />
        <div>
          <h3>Upload song files as releases are completed</h3>
          <p>Album pages are ready. Add MP3 files to the matching public music folder and the play buttons will work.</p>
        </div>
      </section>
    </PageShell>
  );
}
