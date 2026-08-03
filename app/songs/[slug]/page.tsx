'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Clock3, Disc3, Music2 } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { SimilarSongs } from '@/components/discovery/SimilarSongs';
import { useParams } from 'next/navigation';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

type SongRecord = PublicRecord & {
  title?: string;
  name?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artist?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  albumSlug?: string;
  coverImageUrl?: string;
  imageUrl?: string;
  previewUrl?: string;
  duration?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  energy?: number | string;
  price?: number;
  promotional?: boolean;
  description?: string;
  releaseDate?: string;
  details?: Record<string, any>;
};

export default function SongPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: song, loading } = usePublishedDocument<SongRecord>('songs', slug, null);
  const { items: songs } = usePublishedCollection<SongRecord>('songs', []);

  if (!song && !loading) {
    return <main className="page-shell"><Header/><section className="content-panel"><h1>Song not found</h1><p>This song is not published or has been removed.</p><Link className="ghost-button" href="/music">Return to music →</Link></section><Footer/></main>;
  }
  if (!song) return null;

  const details = song.details || {};
  const title = song.title || song.name || 'Untitled track';
  const artist = song.artistName || details.artistName || song.artist || details.artist || 'Aureon Music Group';
  const artistSlug = song.artistSlug || details.artistSlug || '';
  const albumTitle = song.albumTitle || details.albumTitle || '';
  const albumSlug = song.albumSlug || details.albumSlug || '';
  const artwork = song.coverImageUrl || details.coverImageUrl || song.imageUrl || details.imageUrl || '/images/branding/Aureon_Header_Logo.png';
  const preview = song.previewUrl || details.previewUrl || '';
  const duration = song.duration || details.duration || '';
  const genre = song.genre || details.genre || '';
  const mood = song.mood || details.mood || '';
  const bpm = song.bpm || details.bpm || '';
  const energy = song.energy || details.energy || '';
  const price = Number(song.price ?? details.price ?? 0.99);
  const promotional = Boolean(song.promotional ?? details.promotional);
  const description = song.description || details.description || details.story || '';

  return (
    <main className="page-shell song-detail-page">
      <Header/>
      <section className="album-hero-detail">
        <div className="album-detail-cover"><Image src={artwork} alt={`${title} artwork`} width={1000} height={1000} sizes="(max-width: 760px) 100vw, 46vw" priority/></div>
        <div className="album-detail-copy">
          <Link href="/music" className="back-link"><ArrowLeft size={16}/> Back to music</Link>
          <p className="eyebrow">Single · {genre || 'Aureon release'}</p>
          <h1>{title}</h1>
          <h2>{artist}</h2>
          {description && <p>{description}</p>}
          <div className="song-detail-meta" aria-label="Song information">
            {duration && <span><Clock3 size={15}/>{duration}</span>}
            {albumTitle && <span><Disc3 size={15}/>{albumTitle}</span>}
            {mood && <span><Music2 size={15}/>{mood}</span>}
            {bpm && <span>{bpm} BPM</span>}
            {energy && <span>{String(energy)} energy</span>}
          </div>
          <LatestPlayButton
            title={title}
            src={preview}
            buttonLabel="Play preview"
            purchase={{ id:song.id, title, artist, image:artwork, price, promotional, slug:song.slug || slug, artistSlug }}
            analytics={{ id:song.id, artistId:song.artistId || details.artistId, artistName:artist, albumId:song.albumId || details.albumId, albumTitle }}
          />
          <div className="song-detail-links">
            {artistSlug && <Link className="ghost-button" href={`/artists/${artistSlug}`}>View artist →</Link>}
            {albumSlug && <Link className="ghost-button" href={`/music/${albumSlug}`}>View album →</Link>}
          </div>
        </div>
      </section>
      <SimilarSongs currentSong={song} songs={songs}/>
      <Footer/>
    </main>
  );
}
