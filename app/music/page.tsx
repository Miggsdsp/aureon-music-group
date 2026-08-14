'use client';

import Link from 'next/link';
import { Disc3, Music2 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { ArtworkImage } from '@/components/ArtworkImage';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { getArtwork } from '@/lib/get-artwork';
import { getPreviewUrl } from '@/lib/get-preview-url';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type AlbumRecord = PublicRecord & { title:string; slug:string; artist?:string; artistName?:string; genre?:string; year?:string|number; releaseDate?:string; coverUrl?:string; coverImageUrl?:string; songCount?:number; songs?:unknown[]; details?:Record<string,any> };
type SongRecord = PublicRecord & { title?:string; slug?:string; artist?:string; artistName?:string; artistSlug?:string; albumId?:string; albumSlug?:string; genre?:string; releaseDate?:string; coverImageUrl?:string; imageUrl?:string; previewUrl?:string; price?:number; promotional?:boolean; details?:Record<string,any> };

export default function MusicPage() {
  const { items: albums, loading: albumsLoading } = usePublishedCollection<AlbumRecord>('albums', []);
  const { items: songs, loading: songsLoading } = usePublishedCollection<SongRecord>('songs', []);
  const singles = songs.filter(song => !(song.albumId || song.albumSlug || song.details?.albumId || song.details?.albumSlug));
  const loading = albumsLoading || songsLoading;

  return <PageShell title="Music" kicker="Catalogue">
    <section className="music-intro"><div><p className="eyebrow">Aureon Catalogue</p><h2>Albums and releases</h2></div><p>Browse every album and single published through the Aureon Control Center.</p></section>
    {loading ? <div className="store-empty"><h3>Loading music…</h3></div> : <>
      {albums.length > 0 && <section className="album-grid">{albums.map((album) => {
        const cover = getArtwork(album);
        const count = album.songCount ?? album.songs?.length ?? songs.filter(song => song.albumId === album.id || song.albumSlug === album.slug || song.details?.albumId === album.id || song.details?.albumSlug === album.slug).length;
        return <Link href={`/music/${album.slug}`} className="album-card" key={album.id}><div className="album-cover"><ArtworkImage src={cover} alt={`${album.title} album artwork`} width={900} height={900} /></div><div className="album-card-copy"><p>{album.releaseDate || album.details?.releaseDate || album.year || album.details?.year || ''}</p><h3>{album.title}</h3><strong>{album.artistName || album.details?.artistName || album.artist || album.details?.artist || ''}</strong><span>{album.genre || album.details?.genre || ''}</span><div className="album-meta"><Disc3 size={15}/>{count} songs</div><em>Open album →</em></div></Link>;
      })}</section>}
      {singles.length > 0 && <section className="album-track-section"><div className="album-track-heading"><Music2/><div><p className="eyebrow">Published Singles</p><h2>Latest individual releases</h2></div></div><div className="track-list">{[...singles].sort((a,b)=>String(b.releaseDate||b.details?.releaseDate||'').localeCompare(String(a.releaseDate||a.details?.releaseDate||''))).map((song,index)=>{
        const d=song.details||{}; const artist=song.artistName||d.artistName||song.artist||d.artist||'Aureon Artist'; const preview=getPreviewUrl(song); const cover=getArtwork(song);
        return <article className="track-row" key={song.id}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{song.title}</h3><p>{artist} · {song.genre||d.genre||'Single'} · Digital download €{Number(song.price??d.price??0.99).toFixed(2)}</p></div><LatestPlayButton title={song.title||'Untitled'} src={preview} purchase={{id:song.id,title:song.title||'Untitled',artist,image:cover,price:Number(song.price??d.price??0.99),promotional:Boolean(song.promotional??d.promotional),slug:song.slug,artistSlug:song.artistSlug||d.artistSlug}} analytics={{id:song.id,artistId:d.artistId,artistName:artist,albumId:song.albumId||d.albumId,albumTitle:d.albumTitle}}/></article>;
      })}</div></section>}
      {!albums.length && !singles.length && <div className="store-empty"><h3>No published music yet</h3><p>Upload and publish songs or albums in the Aureon Control Center.</p></div>}
    </>}
  </PageShell>;
}
