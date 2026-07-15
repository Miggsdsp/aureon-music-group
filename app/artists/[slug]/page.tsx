'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ListMusic, Music2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { getArtistBySlug, getArtistAudioPath } from '@/data/artists';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type SongRecord = PublicRecord & {
  title?: string;
  name?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  trackNumber?: number;
  duration?: string;
  price?: number;
  promotional?: boolean;
  purchasable?: boolean;
  previewUrl?: string;
  audioUrl?: string;
  coverImageUrl?: string;
  details?: Record<string, any>;
};

function normalise(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export default function ArtistProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const fallback = getArtistBySlug(slug) as any;
  const { data: artist, loading } = usePublishedDocument<any>('artists', slug, fallback || null);
  const { items: publishedSongs, loading: songsLoading } = usePublishedCollection<SongRecord>('songs', []);

  if (!artist && !loading) return <main className="page-shell"><Header/><section className="content-panel"><h1>Artist not found</h1></section><Footer/></main>;
  if (!artist) return null;

  const logo = artist.logoUrl || artist.image || (artist.logo ? `/images/artists/${artist.slug}/${artist.logo}` : '/images/branding/Aureon_Header_Logo.png');
  const audio = artist.previewUrl || artist.audioUrl || (fallback ? getArtistAudioPath(fallback) : '');
  const sound = Array.isArray(artist.sound) ? artist.sound : String(artist.sound || '').split(',').filter(Boolean);
  const artistName = artist.name || artist.title || '';
  const artistSlug = artist.slug || slug;
  const artistIdentifiers = new Set([
    normalise(artist.id),
    normalise(artist.artistCode),
    normalise(artistSlug),
    normalise(artistName)
  ].filter(Boolean));

  const songs = publishedSongs
    .filter((song) => {
      const details = song.details || {};
      const candidates = [
        song.artistId,
        details.artistId,
        song.artistSlug,
        details.artistSlug,
        song.artistName,
        details.artistName
      ].map(normalise).filter(Boolean);
      return candidates.some((candidate) => artistIdentifiers.has(candidate));
    })
    .sort((a, b) => {
      const aTrack = Number(a.trackNumber ?? a.details?.trackNumber ?? 9999);
      const bTrack = Number(b.trackNumber ?? b.details?.trackNumber ?? 9999);
      if (aTrack !== bTrack) return aTrack - bTrack;
      return String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''));
    });

  return <main className="page-shell artist-profile-page"><Header/>
    <section className={`artist-profile-hero artist-${artist.slug}`}>
      <div className="artist-profile-logo-wrap"><Image src={logo} alt={`${artistName} logo`} width={1000} height={1000} unoptimized className="artist-profile-logo"/></div>
      <div className="artist-profile-copy"><Link href="/artists" className="back-link"><ArrowLeft size={16}/> Back to artists</Link><p className="eyebrow">{artist.artistCode || artist.id} · {artist.genre}</p><h1>{artistName}</h1><p className="artist-profile-desc">{artist.bio || artist.description || artist.desc}</p>{audio ? <LatestPlayButton title={artist.latest || artist.latestTitle || 'Latest release'} src={audio}/> : null}</div>
    </section>

    <section className="artist-profile-panel"><div><p className="eyebrow">Sound Identity</p><h2>{artistName} sound profile</h2><p>{artist.description || artist.desc}</p></div><div className="artist-sound-list">{sound.map((item:string)=><article key={item}><Music2 size={20}/><span>{item.trim()}</span></article>)}</div></section>

    <section className="album-track-section">
      <div className="album-track-heading"><ListMusic/><div><p className="eyebrow">Official Catalogue</p><h2>{artistName} songs</h2></div></div>
      {songsLoading ? <p>Loading music…</p> : songs.length ? (
        <div className="track-list">{songs.map((song, index) => {
          const details = song.details || {};
          const title = song.title || song.name || 'Untitled song';
          const preview = song.previewUrl || details.previewUrl || song.audioUrl || details.audioUrl || '';
          const price = Number(song.price ?? details.price ?? 0.99);
          const promotional = Boolean(song.promotional ?? details.promotional);
          const purchasable = song.purchasable !== false && details.purchasable !== false;
          const image = song.coverImageUrl || details.coverImageUrl || logo;
          return <article className="track-row" key={song.id}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{title}</h3><p>{song.albumTitle || details.albumTitle || 'Single'} · {song.duration || details.duration || ''} · {promotional ? 'Free release' : `Digital download €${price.toFixed(2)}`}</p></div>
            <LatestPlayButton title={title} src={preview} purchase={purchasable ? {id:song.id,title,artist:artistName,image,price,promotional} : undefined}/>
          </article>;
        })}</div>
      ) : <p className="preview-ended-message">No published songs have been uploaded for this artist yet.</p>}
    </section>
    <Footer/>
  </main>;
}
