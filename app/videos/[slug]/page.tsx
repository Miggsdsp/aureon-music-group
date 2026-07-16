'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Clapperboard, Film } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type VideoRecord=PublicRecord&{title?:string;slug?:string;artistId?:string;artistName?:string;artistSlug?:string;videoAlbumId?:string;videoAlbumSlug?:string;albumId?:string;albumSlug?:string;videoUrl?:string;externalUrl?:string;youtubeUrl?:string;vimeoUrl?:string;thumbnailUrl?:string;duration?:string;type?:string;trackNumber?:number;details?:Record<string,any>};
const norm=(value:unknown)=>String(value||'').trim().toLowerCase();

export default function VideoAlbumPage(){
 const {slug}=useParams<{slug:string}>();
 const {data:album,loading}=usePublishedDocument<any>('videoAlbums',slug,null);
 const {items:allVideos}=usePublishedCollection<VideoRecord>('videos',[]);
 if(!album&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Video album not found</h1><p>This visual release is not published or has been removed.</p></section><Footer/></main>;
 if(!album)return null;
 const d=album.details||{};
 const cover=album.coverImageUrl||album.coverUrl||album.thumbnailUrl||d.coverImageUrl||'/images/branding/Aureon_Header_Logo.png';
 const artistName=album.artistName||album.artist||d.artistName||'';
 const artistSlug=album.artistSlug||d.artistSlug||'';
 const videos=allVideos.filter(video=>{const vd=video.details||{};const sameAlbum=(video.videoAlbumId||vd.videoAlbumId||video.albumId||vd.albumId)===album.id||norm(video.videoAlbumSlug||vd.videoAlbumSlug||video.albumSlug||vd.albumSlug)===norm(album.slug||slug);const sameArtist=!artistSlug&&!artistName||norm(video.artistSlug||vd.artistSlug)===norm(artistSlug)||norm(video.artistName||vd.artistName)===norm(artistName);return sameAlbum&&sameArtist;}).sort((a,b)=>Number(a.trackNumber??a.details?.trackNumber??999)-Number(b.trackNumber??b.details?.trackNumber??999));
 return <main className="page-shell video-detail-page"><Header/>
  <section className="album-hero-detail video-hero-detail"><div className="album-detail-cover video-detail-cover"><Image src={cover} alt={`${album.title} video album artwork`} width={1000} height={1000} unoptimized/><div className="video-play-mark large"><Film size={40}/></div></div><div className="album-detail-copy"><Link href="/videos" className="back-link"><ArrowLeft size={16}/> Back to video albums</Link><p className="eyebrow">{album.genre||''} · {album.releaseDate||album.year||''}</p><h1>{album.title}</h1><h2>{artistName}</h2><p>{album.description||''}</p>{artistSlug?<Link className="ghost-button" href={`/artists/${artistSlug}`}>View artist profile →</Link>:null}</div></section>
  <section className="album-track-section video-list-section"><div className="album-track-heading"><Clapperboard/><div><p className="eyebrow">Video List</p><h2>Videos in this album</h2></div></div>
   {videos.length?<div className="video-list-grid">{videos.map((video,index)=>{const vd=video.details||{};const src=video.videoUrl||vd.videoUrl||video.externalUrl||video.youtubeUrl||video.vimeoUrl||'';const poster=video.thumbnailUrl||vd.thumbnailUrl||cover;const external=/youtube|youtu\.be|vimeo/.test(src);return <article className="video-row-card" key={video.id}><div className="video-placeholder"><span>{String(video.trackNumber||vd.trackNumber||index+1).padStart(2,'0')}</span>{src?(external?<a className="ghost-button" href={src} target="_blank" rel="noreferrer">Watch video →</a>:<video src={src} controls preload="metadata" poster={poster}/>):<p>Video coming soon.</p>}</div><div><p className="eyebrow">{video.type||vd.type||'Music video'} · {video.duration||vd.duration||''}</p><h3>{video.title}</h3></div></article>})}</div>:<div className="store-empty"><h3>No published videos yet</h3><p>Upload videos and assign them to this video album in the Control Center.</p></div>}
  </section><Footer/></main>;
}