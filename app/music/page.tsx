'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Disc3, Music2 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { albums as fallbackAlbums } from '@/data/albums';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type AlbumRecord = PublicRecord & { title:string; slug:string; artist?:string; artistName?:string; genre?:string; year?:string|number; releaseDate?:string; cover?:string; coverUrl?:string; coverImageUrl?:string; songCount?:number; songs?:unknown[] };
type SongRecord = PublicRecord & { title?:string; slug?:string; artist?:string; artistName?:string; artistSlug?:string; albumId?:string; albumSlug?:string; genre?:string; releaseDate?:string; coverImageUrl?:string; imageUrl?:string; previewUrl?:string; price?:number; promotional?:boolean; details?:Record<string,any> };
const fallback = fallbackAlbums.map((album) => ({ ...album, id: album.id } as AlbumRecord));

export default function MusicPage() {
  const { items: albums } = usePublishedCollection<AlbumRecord>('albums', fallback);
  const { items: songs } = usePublishedCollection<SongRecord>('songs', []);
  const singles = songs.filter(song => !(song.albumId || song.albumSlug || song.details?.albumId || song.details?.albumSlug));

  return <PageShell title="Music" kicker="Catalogue">
    <section className="music-intro"><div><p className="eyebrow">Aureon Catalogue</p><h2>Albums and releases</h2></div><p>Browse Aureon albums and every published single uploaded through the Control Center.</p></section>
    <section className="album-grid">{albums.map((album) => {
      const cover = album.coverImageUrl || album.coverUrl || album.cover || '/images/branding/Aureon_Header_Logo.png';
      const count = album.songCount ?? album.songs?.length ?? songs.filter(song => song.albumId === album.id || song.albumSlug === album.slug || song.details?.albumId === album.id || song.details?.albumSlug === album.slug).length;
      return <Link href={`/music/${album.slug}`} className="album-card" key={album.id}><div className="album-cover"><Image src={cover} alt={`${album.title} album artwork`} width={900} height={900} unoptimized /></div><div className="album-card-copy"><p>{album.id} · {album.year || album.releaseDate || ''}</p><h3>{album.title}</h3><strong>{album.artistName || album.artist || ''}</strong><span>{album.genre || ''}</span><div className="album-meta"><Disc3 size={15}/>{count} songs</div><em>Open album →</em></div></Link>;
    })}</section>
    {singles.length > 0 && <section className="album-track-section"><div className="album-track-heading"><Music2/><div><p className="eyebrow">Published Singles</p><h2>Latest individual releases</h2></div></div><div className="track-list">{singles.sort((a,b)=>String(b.releaseDate||'').localeCompare(String(a.releaseDate||''))).map((song,index)=>{
      const d=song.details||{}; const artist=song.artistName||d.artistName||song.artist||'Aureon Artist'; const preview=song.previewUrl||d.previewUrl||''; const cover=song.coverImageUrl||d.coverImageUrl||song.imageUrl||'/images/branding/Aureon_Header_Logo.png';
      return <article className="track-row" key={song.id}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{song.title}</h3><p>{artist} · {song.genre||d.genre||'Single'} · Digital download €{Number(song.price??d.price??0.99).toFixed(2)}</p></div><LatestPlayButton title={song.title||'Untitled'} src={preview} purchase={{id:song.id,title:song.title||'Untitled',artist,image:cover,price:Number(song.price??d.price??0.99),promotional:Boolean(song.promotional??d.promotional)}}/></article>
    })}</div></section>}
  </PageShell>;
}
