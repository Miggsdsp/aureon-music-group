'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Clapperboard, Film } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { videoAlbums as fallbackVideoAlbums } from '@/data/videoAlbums';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type VideoAlbumRecord = PublicRecord & { title:string; slug:string; artist?:string; genre?:string; year?:string|number; cover?:string; coverUrl?:string; videoCount?:number; videos?:unknown[] };
const fallback = fallbackVideoAlbums.map((album) => ({ ...album, id: album.id } as VideoAlbumRecord));

export default function VideosPage() {
  const { items: videoAlbums } = usePublishedCollection<VideoAlbumRecord>('videoAlbums', fallback);
  return <PageShell title="Videos" kicker="Visual World">
    <section className="music-intro video-intro"><div><p className="eyebrow">Aureon Visual Catalogue</p><h2>Video albums and visual releases</h2></div><p>Browse Aureon video albums, open a release, then view the music videos, lyric videos and visualizers inside that album.</p></section>
    <section className="album-grid video-album-grid">{videoAlbums.map((album) => {
      const cover = album.coverUrl || album.cover || '/images/branding/Aureon_Header_Logo.png';
      const count = album.videoCount ?? album.videos?.length ?? 0;
      return <Link href={`/videos/${album.slug}`} className="album-card video-album-card" key={album.id}><div className="album-cover video-cover"><Image src={cover} alt={`${album.title} video album artwork`} width={900} height={900} unoptimized/><div className="video-play-mark"><Film size={28}/></div></div><div className="album-card-copy"><p>{album.id} · {album.year || ''}</p><h3>{album.title}</h3><strong>{album.artist || ''}</strong><span>{album.genre || ''}</span><div className="album-meta"><Clapperboard size={15}/>{count} videos</div><em>Open video album →</em></div></Link>;
    })}</section>
  </PageShell>;
}
