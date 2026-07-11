'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Music2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { getArtistBySlug, getArtistAudioPath } from '@/data/artists';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export default function ArtistProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const fallback = getArtistBySlug(slug) as any;
  const { data: artist, loading } = usePublishedDocument<any>('artists', slug, fallback || null);
  if (!artist && !loading) return <main className="page-shell"><Header/><section className="content-panel"><h1>Artist not found</h1></section><Footer/></main>;
  if (!artist) return null;
  const logo = artist.logoUrl || artist.image || (artist.logo ? `/images/artists/${artist.slug}/${artist.logo}` : '/images/branding/Aureon_Header_Logo.png');
  const audio = artist.previewUrl || artist.audioUrl || (fallback ? getArtistAudioPath(fallback) : '');
  const sound = Array.isArray(artist.sound) ? artist.sound : String(artist.sound || '').split(',').filter(Boolean);
  return <main className="page-shell artist-profile-page"><Header/>
    <section className={`artist-profile-hero artist-${artist.slug}`}>
      <div className="artist-profile-logo-wrap"><Image src={logo} alt={`${artist.name} logo`} width={1000} height={1000} unoptimized className="artist-profile-logo"/></div>
      <div className="artist-profile-copy"><Link href="/artists" className="back-link"><ArrowLeft size={16}/> Back to artists</Link><p className="eyebrow">{artist.artistCode || artist.id} · {artist.genre}</p><h1>{artist.name}</h1><p className="artist-profile-desc">{artist.bio || artist.description || artist.desc}</p>{audio ? <LatestPlayButton title={artist.latest || artist.latestTitle || 'Latest release'} src={audio}/> : null}</div>
    </section>
    <section className="artist-profile-panel"><div><p className="eyebrow">Sound Identity</p><h2>{artist.name} sound profile</h2><p>{artist.description || artist.desc}</p></div><div className="artist-sound-list">{sound.map((item:string)=><article key={item}><Music2 size={20}/><span>{item.trim()}</span></article>)}</div></section>
    <Footer/></main>;
}
