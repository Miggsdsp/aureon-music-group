'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ListMusic, Music2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type SongRecord = PublicRecord & { title?:string; name?:string; slug?:string; artistId?:string; artistName?:string; artistSlug?:string; albumId?:string; albumTitle?:string; trackNumber?:number; duration?:string; price?:number; promotional?:boolean; purchasable?:boolean; previewUrl?:string; audioUrl?:string; coverImageUrl?:string; details?:Record<string,any> };
function normalise(value: unknown){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')}

export default function ArtistProfilePage(){
 const {slug}=useParams<{slug:string}>();
 const {data:artist,loading}=usePublishedDocument<any>('artists',slug,null);
 const {items:publishedSongs,loading:songsLoading}=usePublishedCollection<SongRecord>('songs',[]);
 if(!artist&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Artist not found</h1><p>This artist has not been published in the Control Center.</p></section><Footer/></main>;
 if(!artist)return null;
 const logo=artist.logoUrl||artist.profileImageUrl||artist.image||'/images/branding/Aureon_Header_Logo.png';
 const sound=Array.isArray(artist.sound)?artist.sound:String(artist.sound||'').split(',').filter(Boolean);
 const artistName=artist.name||artist.title||''; const artistSlug=artist.slug||slug;
 const ids=new Set([normalise(artist.id),normalise(artist.artistCode),normalise(artistSlug),normalise(artistName)].filter(Boolean));
 const songs=publishedSongs.filter(song=>{const d=song.details||{};return [song.artistId,d.artistId,song.artistSlug,d.artistSlug,song.artistName,d.artistName].map(normalise).filter(Boolean).some(v=>ids.has(v))}).sort((a,b)=>{const at=Number(a.trackNumber??a.details?.trackNumber??9999),bt=Number(b.trackNumber??b.details?.trackNumber??9999);return at!==bt?at-bt:String(a.title||a.name||'').localeCompare(String(b.title||b.name||''))});
 const latest=songs[0]; const latestPreview=latest?.previewUrl||latest?.details?.previewUrl||'';
 return <main className="page-shell artist-profile-page"><Header/>
  <section className={`artist-profile-hero artist-${artist.slug}`}><div className="artist-profile-logo-wrap"><Image src={logo} alt={`${artistName} logo`} width={1000} height={1000} unoptimized className="artist-profile-logo"/></div><div className="artist-profile-copy"><Link href="/artists" className="back-link"><ArrowLeft size={16}/> Back to artists</Link><p className="eyebrow">{artist.artistCode||artist.id} · {artist.genre||''}</p><h1>{artistName}</h1><p className="artist-profile-desc">{artist.bio||artist.description||''}</p>{latestPreview?<LatestPlayButton title={latest?.title||latest?.name||'Latest release'} src={latestPreview}/>:null}</div></section>
  <section className="artist-profile-panel"><div><p className="eyebrow">Sound Identity</p><h2>{artistName} sound profile</h2><p>{artist.description||''}</p></div><div className="artist-sound-list">{sound.map((item:string)=><article key={item}><Music2 size={20}/><span>{item.trim()}</span></article>)}</div></section>
  <section className="album-track-section"><div className="album-track-heading"><ListMusic/><div><p className="eyebrow">Official Catalogue</p><h2>{artistName} songs</h2></div></div>{songsLoading?<p>Loading music…</p>:songs.length?<div className="track-list">{songs.map((song,index)=>{const d=song.details||{},title=song.title||song.name||'Untitled song',preview=song.previewUrl||d.previewUrl||'',price=Number(song.price??d.price??0.99),promotional=Boolean(song.promotional??d.promotional),purchasable=song.purchasable!==false&&d.purchasable!==false,image=song.coverImageUrl||d.coverImageUrl||logo;return <article className="track-row" key={song.id}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{song.albumTitle||d.albumTitle||'Single'} · {song.duration||d.duration||''} · {promotional?'Free release':`Digital download €${price.toFixed(2)}`}</p></div><LatestPlayButton title={title} src={preview} purchase={purchasable?{id:song.id,title,artist:artistName,image,price,promotional}:undefined}/></article>})}</div>:<p className="preview-ended-message">No published songs have been uploaded for this artist yet.</p>}</section>
  <Footer/>
 </main>
}
