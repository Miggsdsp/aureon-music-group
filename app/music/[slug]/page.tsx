'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ListMusic } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { SimilarAlbums } from '@/components/discovery/SimilarAlbums';
import { getArtwork } from '@/lib/get-artwork';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import { getPreviewUrl } from '@/lib/get-preview-url';
import styles from './AlbumPage.module.css';

type SongRecord = PublicRecord & { title?:string; slug?:string; artistId?:string; artistName?:string; artistSlug?:string; albumId?:string; albumTitle?:string; albumSlug?:string; duration?:string; price?:number; promotional?:boolean; previewUrl?:string; trackNumber?:number; details?:Record<string,any> };
type AlbumRecord = PublicRecord & { title?:string; slug?:string; artistId?:string; artistName?:string; artistSlug?:string; genre?:string; mood?:string; releaseDate?:string; year?:string|number; coverImageUrl?:string; coverUrl?:string; details?:Record<string,any> };
const norm=(value:unknown)=>String(value||'').trim().toLowerCase();

export default function AlbumPage(){
 const {slug}=useParams<{slug:string}>();
 const {data:album,loading}=usePublishedDocument<any>('albums',slug,null);
 const {items:allSongs}=usePublishedCollection<SongRecord>('songs',[]);
 const {items:allAlbums}=usePublishedCollection<AlbumRecord>('albums',[]);
 if(!album&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Album not found</h1><p>This album is not published or has been removed.</p></section><Footer/></main>;
 if(!album)return null;
 const details=album.details||{};
 const cover=getArtwork(album);
 const artistName=album.artistName||details.artistName||'';
 const artistSlug=album.artistSlug||details.artistSlug||'';
 const songs=allSongs.filter(song=>{
   const d=song.details||{};
   const sameAlbum=(song.albumId||d.albumId)===album.id||norm(song.albumSlug||d.albumSlug)===norm(album.slug||slug)||norm(song.albumTitle||d.albumTitle)===norm(album.title);
   const sameArtist=!artistSlug&&!artistName||norm(song.artistSlug||d.artistSlug)===norm(artistSlug)||norm(song.artistName||d.artistName)===norm(artistName);
   return sameAlbum&&sameArtist;
 }).sort((a,b)=>Number(a.trackNumber??a.details?.trackNumber??999)-Number(b.trackNumber??b.details?.trackNumber??999));
 return <main className="page-shell album-detail-page"><Header/>
  <section className="album-hero-detail"><div className="album-detail-cover"><ArtworkImage src={cover} alt={`${album.title} album artwork`} width={1000} height={1000}/></div><div className="album-detail-copy"><Link href="/music" className="back-link"><ArrowLeft size={16}/> Back to music</Link><p className="eyebrow">{album.genre||''} · {album.releaseDate||album.year||''}</p><h1>{album.title}</h1><h2>{artistName}</h2><p>{album.description||''}</p>{artistSlug?<Link className="ghost-button" href={`/artists/${artistSlug}`}>View artist profile →</Link>:null}</div></section>
  <section className={styles.trackSection}><div className={styles.trackHeading}><ListMusic/><div><p className="eyebrow">Track List</p><h2>Songs in this album</h2></div></div>
   {songs.length?<div className={styles.trackList}>{songs.map((song,index)=>{const d=song.details||{};const price=Number(song.price??d.price??0.99);const src=getPreviewUrl(song);const songArtist=song.artistName||d.artistName||artistName;const songHref=`/songs/${song.slug||song.id}`;const songArtwork=getArtwork(song,cover);return <article className={styles.trackRow} key={song.id}><span className={styles.trackNumber}>{String(song.trackNumber||d.trackNumber||index+1).padStart(2,'0')}</span><div className={styles.trackCopy}><h3><Link href={songHref}>{song.title}</Link></h3><p>{songArtist} · {song.duration||d.duration||''} · Digital download €{price.toFixed(2)}</p></div><div className={styles.trackActions}><LatestPlayButton title={song.title||'Track'} src={src} purchase={{id:song.id,title:song.title||'Track',artist:songArtist,image:songArtwork,price,promotional:Boolean(song.promotional??d.promotional),slug:song.slug||song.id,artistSlug:song.artistSlug||d.artistSlug}}/></div></article>})}</div>:<div className="store-empty"><h3>No published tracks yet</h3><p>Assign and publish songs for this album in the Control Center.</p></div>}
  </section>
  <SimilarAlbums currentAlbum={album as AlbumRecord} albums={allAlbums} songs={allSongs}/>
  <Footer/></main>;
}
