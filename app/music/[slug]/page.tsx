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

export default function AlbumPage() {
  const { slug } = useParams<{ slug: string }>();
  const fallback = getAlbumBySlug(slug) as any;
  const { data: album, loading } = usePublishedDocument<any>('albums', slug, fallback || null);
  if (!album && !loading) return <main className="page-shell"><Header/><section className="content-panel"><h1>Album not found</h1></section><Footer/></main>;
  if (!album) return null;
  const cover = album.coverUrl || album.cover || album.image || '/images/branding/Aureon_Header_Logo.png';
  const songs = Array.isArray(album.songs) ? album.songs : [];
  return <main className="page-shell album-detail-page"><Header/>
    <section className="album-hero-detail"><div className="album-detail-cover"><Image src={cover} alt={`${album.title} album artwork`} width={1000} height={1000} unoptimized/></div>
      <div className="album-detail-copy"><Link href="/music" className="back-link"><ArrowLeft size={16}/> Back to albums</Link><p className="eyebrow">{album.albumCode || album.id} · {album.genre} · {album.year || album.releaseYear || ''}</p><h1>{album.title}</h1><h2>{album.artist}</h2><p>{album.description}</p>{album.artistSlug ? <Link className="ghost-button" href={`/artists/${album.artistSlug}`}>View artist profile →</Link> : null}</div>
    </section>
    <section className="album-track-section"><div className="album-track-heading"><ListMusic/><div><p className="eyebrow">Track List</p><h2>Songs in this album</h2></div></div>
      <div className="track-list">{songs.map((song:any,index:number)=>{const src=song.previewUrl || song.audioUrl || (fallback ? getSongAudioPath(fallback, song) : ''); return <article className="track-row" key={song.id || song.title}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{song.title}</h3><p>{album.artist} · {song.duration || ''} · Digital download €{Number(song.price ?? 0.99).toFixed(2)}</p></div>{src ? <LatestPlayButton title={song.title} src={src} purchase={{id:song.id || `${album.slug}-${index}`,title:song.title,artist:album.artist,image:cover,price:Number(song.price ?? 0.99),promotional:Boolean(song.promotional)}}/> : null}</article>})}</div>
    </section><Footer/></main>;
}
