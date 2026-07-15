'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clapperboard, Film } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type VideoAlbumRecord = PublicRecord & { title:string; slug:string; artist?:string; artistName?:string; genre?:string; year?:string|number; releaseDate?:string; coverUrl?:string; coverImageUrl?:string; thumbnailUrl?:string; videoCount?:number; videos?:unknown[] };

export default function VideosPage(){
 const {items:videoAlbums,loading}=usePublishedCollection<VideoAlbumRecord>('videoAlbums',[]);
 return <PageShell title="Videos" kicker="Visual World">
  <section className="music-intro video-intro"><div><p className="eyebrow">Aureon Visual Catalogue</p><h2>Video albums and visual releases</h2></div><p>Every published visual release uploaded through the Aureon Control Center appears here automatically.</p></section>
  {loading?<div className="store-empty"><h3>Loading videos…</h3></div>:videoAlbums.length?<section className="album-grid video-album-grid">{videoAlbums.map(album=>{const cover=album.coverImageUrl||album.coverUrl||album.thumbnailUrl||'/images/branding/Aureon_Header_Logo.png';const count=album.videoCount??album.videos?.length??0;return <Link href={`/videos/${album.slug}`} className="album-card video-album-card" key={album.id}><div className="album-cover video-cover"><Image src={cover} alt={`${album.title} video album artwork`} width={900} height={900} unoptimized/><div className="video-play-mark"><Film size={28}/></div></div><div className="album-card-copy"><p>{album.releaseDate||album.year||''}</p><h3>{album.title}</h3><strong>{album.artistName||album.artist||''}</strong><span>{album.genre||''}</span><div className="album-meta"><Clapperboard size={15}/>{count} videos</div><em>Open video album →</em></div></Link>})}</section>:<div className="store-empty"><h3>No published videos yet</h3><p>Upload and publish a video release in the Aureon Control Center.</p></div>}
 </PageShell>
}
