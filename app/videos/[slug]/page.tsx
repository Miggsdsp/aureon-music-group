'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clapperboard, Film } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getVideoAlbumBySlug, getVideoPath } from '@/data/videoAlbums';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export default function VideoAlbumPage(){
 const {slug}=useParams<{slug:string}>();
 const fallback=getVideoAlbumBySlug(slug) as any;
 const {data:album,loading}=usePublishedDocument<any>('videoAlbums',slug,fallback||null);
 if(!album&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Video album not found</h1></section><Footer/></main>;
 if(!album)return null;
 const cover=album.coverUrl||album.cover||album.image||'/images/branding/Aureon_Header_Logo.png';
 const videos=Array.isArray(album.videos)?album.videos:[];
 return <main className="page-shell video-detail-page"><Header/>
  <section className="album-hero-detail video-hero-detail"><div className="album-detail-cover video-detail-cover"><Image src={cover} alt={`${album.title} video album artwork`} width={1000} height={1000} unoptimized/><div className="video-play-mark large"><Film size={40}/></div></div>
   <div className="album-detail-copy"><Link href="/videos" className="back-link"><ArrowLeft size={16}/> Back to video albums</Link><p className="eyebrow">{album.videoCode||album.id} · {album.genre} · {album.year||''}</p><h1>{album.title}</h1><h2>{album.artist}</h2><p>{album.description}</p>{album.artistSlug?<Link className="ghost-button" href={`/artists/${album.artistSlug}`}>View artist profile →</Link>:null}</div>
  </section>
  <section className="album-track-section video-list-section"><div className="album-track-heading"><Clapperboard/><div><p className="eyebrow">Video List</p><h2>Videos in this album</h2></div></div>
   <div className="video-list-grid">{videos.map((video:any,index:number)=>{const src=video.videoUrl||video.url||video.src||(fallback?getVideoPath(fallback,video):'');return <article className="video-row-card" key={video.id||video.title}><div className="video-placeholder"><span>{String(index+1).padStart(2,'0')}</span>{src?<video src={src} controls preload="none" poster={video.thumbnailUrl||video.thumbnail}/>:null}</div><div><p className="eyebrow">{video.type||'Music video'} · {video.duration||''}</p><h3>{video.title}</h3></div></article>})}</div>
  </section><Footer/></main>;
}
