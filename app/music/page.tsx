'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Disc3 } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { albums as fallbackAlbums } from '@/data/albums';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type AlbumRecord = PublicRecord & { title:string; slug:string; artist?:string; genre?:string; year?:string|number; cover?:string; coverUrl?:string; songCount?:number; songs?:unknown[] };
const fallback = fallbackAlbums.map((album) => ({ ...album, id: album.id } as AlbumRecord));

export default function MusicPage() {
  const { items: albums } = usePublishedCollection<AlbumRecord>('albums', fallback);
  return <PageShell title="Music" kicker="Catalogue">
    <section className="music-intro"><div><p className="eyebrow">Aureon Catalogue</p><h2>Albums and releases</h2></div><p>Browse Aureon albums, open a release, preview the available songs and purchase complete digital downloads.</p></section>
    <section className="album-grid">{albums.map((album) => {
      const cover = album.coverUrl || album.cover || '/images/branding/Aureon_Header_Logo.png';
      const count = album.songCount ?? album.songs?.length ?? 0;
      return <Link href={`/music/${album.slug}`} className="album-card" key={album.id}><div className="album-cover"><Image src={cover} alt={`${album.title} album artwork`} width={900} height={900} unoptimized /></div><div className="album-card-copy"><p>{album.id} · {album.year || ''}</p><h3>{album.title}</h3><strong>{album.artist || ''}</strong><span>{album.genre || ''}</span><div className="album-meta"><Disc3 size={15}/>{count} songs</div><em>Open album →</em></div></Link>;
    })}</section>
  </PageShell>;
}
