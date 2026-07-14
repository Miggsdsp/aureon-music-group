'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ListMusic } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { getAlbumBySlug, getSongAudioPath } from '@/data/albums';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type SongRecord = PublicRecord & {
  title?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  albumSlug?: string;
  duration?: string;
  price?: number;
  promotional?: boolean;
  previewUrl?: string;
  audioUrl?: string;
  details?: {
    previewUrl?: string;
    audioUrl?: string;
    artistId?: string;
    artistName?: string;
    artistSlug?: string;
    albumId?: string;
    albumTitle?: string;
    albumSlug?: string;
    duration?: string;
    price?: number;
    promotional?: boolean;
  };
};

function normalise(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export default function AlbumPage() {
  const { slug } = useParams<{ slug: string }>();
  const fallback = getAlbumBySlug(slug) as any;
  const { data: album, loading } = usePublishedDocument<any>('albums', slug, fallback || null);
  const { items: uploadedSongs } = usePublishedCollection<SongRecord>('songs', []);

  if (!album && !loading) return <main className="page-shell"><Header/><section className="content-panel"><h1>Album not found</h1></section><Footer/></main>;
  if (!album) return null;

  const cover = album.coverImageUrl || album.details?.coverImageUrl || album.coverUrl || album.cover || album.image || '/images/branding/Aureon_Header_Logo.png';
  const albumArtist = album.artistName || album.artist || album.details?.artistName || '';
  const albumArtistSlug = album.artistSlug || album.details?.artistSlug || '';
  const staticSongs = Array.isArray(album.songs) ? album.songs : [];

  const songsForAlbum = uploadedSongs.filter((song) => {
    const details = song.details || {};
    const songAlbumId = song.albumId || details.albumId;
    const songAlbumSlug = song.albumSlug || details.albumSlug;
    const songAlbumTitle = song.albumTitle || details.albumTitle;
    const songArtistSlug = song.artistSlug || details.artistSlug;
    const songArtistName = song.artistName || details.artistName;

    return Boolean(
      (album.id && songAlbumId === album.id) ||
      (songAlbumSlug && normalise(songAlbumSlug) === normalise(album.slug || slug)) ||
      (songAlbumTitle && normalise(songAlbumTitle) === normalise(album.title)) ||
      (!songAlbumId && !songAlbumSlug && !songAlbumTitle && (
        (albumArtistSlug && normalise(songArtistSlug) === normalise(albumArtistSlug)) ||
        (albumArtist && normalise(songArtistName) === normalise(albumArtist))
      ) && staticSongs.some((track:any) => normalise(track.title) === normalise(song.title)))
    );
  });

  const mergedSongs = staticSongs.map((track:any) => {
    const uploaded = songsForAlbum.find((song) =>
      normalise(song.title) === normalise(track.title) ||
      (track.slug && normalise(song.slug) === normalise(track.slug))
    );
    if (!uploaded) return track;
    return {
      ...track,
      ...uploaded,
      details: { ...(track.details || {}), ...(uploaded.details || {}) },
      previewUrl: uploaded.previewUrl || uploaded.details?.previewUrl || track.previewUrl,
      audioUrl: uploaded.audioUrl || uploaded.details?.audioUrl || track.audioUrl,
      price: uploaded.price ?? uploaded.details?.price ?? track.price,
      promotional: uploaded.promotional ?? uploaded.details?.promotional ?? track.promotional,
      duration: uploaded.duration || uploaded.details?.duration || track.duration
    };
  });

  const existingTitles = new Set(mergedSongs.map((song:any) => normalise(song.title)));
  const extraUploadedSongs = songsForAlbum.filter((song) => !existingTitles.has(normalise(song.title)));
  const songs = [...mergedSongs, ...extraUploadedSongs];

  return <main className="page-shell album-detail-page"><Header/>
    <section className="album-hero-detail"><div className="album-detail-cover"><Image src={cover} alt={`${album.title} album artwork`} width={1000} height={1000} unoptimized/></div>
      <div className="album-detail-copy"><Link href="/music" className="back-link"><ArrowLeft size={16}/> Back to albums</Link><p className="eyebrow">{album.albumCode || album.id} · {album.genre} · {album.year || album.releaseYear || ''}</p><h1>{album.title}</h1><h2>{albumArtist}</h2><p>{album.description}</p>{albumArtistSlug ? <Link className="ghost-button" href={`/artists/${albumArtistSlug}`}>View artist profile →</Link> : null}</div>
    </section>
    <section className="album-track-section"><div className="album-track-heading"><ListMusic/><div><p className="eyebrow">Track List</p><h2>Songs in this album</h2></div></div>
      <div className="track-list">{songs.map((song:any,index:number)=>{
        const src = song.previewUrl || song.details?.previewUrl || song.audioUrl || song.details?.audioUrl || (fallback ? getSongAudioPath(fallback, song) : '');
        const artistName = song.artistName || song.details?.artistName || albumArtist;
        return <article className="track-row" key={song.id || song.slug || song.title}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{song.title}</h3><p>{artistName} · {song.duration || song.details?.duration || ''} · Digital download €{Number(song.price ?? song.details?.price ?? 0.99).toFixed(2)}</p></div><LatestPlayButton title={song.title} src={src} purchase={{id:song.id || song.slug || `${album.slug || slug}-${index}`,title:song.title,artist:artistName,image:cover,price:Number(song.price ?? song.details?.price ?? 0.99),promotional:Boolean(song.promotional ?? song.details?.promotional)}}/></article>})}</div>
    </section><Footer/></main>;
}
