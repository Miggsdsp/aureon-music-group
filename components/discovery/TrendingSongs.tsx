'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { trackDiscovery, useDiscoveryImpressions } from '@/lib/discovery-analytics';
import styles from './TrendingSongs.module.css';

type WindowKey='1h'|'24h'|'7d'|'30d';
type Song={id:string;slug:string;title:string;artist:string;artistSlug?:string;artwork?:string;previewUrl?:string;duration?:number;score:number;rank:number};
const windows:Array<{key:WindowKey;label:string}>=[{key:'1h',label:'Last hour'},{key:'24h',label:'24 hours'},{key:'7d',label:'7 days'},{key:'30d',label:'30 days'}];
function durationLabel(value?:number){if(!value||!Number.isFinite(value))return'—';return`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`}

export function TrendingSongs({compact=false,initialWindow='24h'}:{compact?:boolean;initialWindow?:WindowKey}){
 const[windowKey,setWindowKey]=useState<WindowKey>(initialWindow);const[songs,setSongs]=useState<Song[]>([]);const[loading,setLoading]=useState(true);
 useEffect(()=>{let cancelled=false;async function load(){setLoading(true);try{const response=await fetch(`/api/discovery/trending?window=${windowKey}&limit=${compact?6:20}`);const data=await response.json();if(!cancelled)setSongs(Array.isArray(data.songs)?data.songs:[])}catch{if(!cancelled)setSongs([])}finally{if(!cancelled)setLoading(false)}}void load();return()=>{cancelled=true}},[compact,windowKey]);
 const algorithm=`time_decay_trending_${windowKey}`;
 const impressions=useMemo(()=>songs.map(song=>({entity:{id:song.id,type:'song' as const,title:song.title,artistName:song.artist},context:{source:compact?'homepage_trending':'trending_songs',algorithm,position:song.rank}})),[algorithm,compact,songs]);
 useDiscoveryImpressions(impressions);
 const click=(song:Song,interaction:string)=>trackDiscovery('click',{id:song.id,type:'song',title:song.title,artistName:song.artist},{source:compact?'homepage_trending':'trending_songs',algorithm,position:song.rank,interaction});
 return <section className={`${styles.section} ${compact?styles.compact:''}`} aria-labelledby="trending-songs-heading"><div className={styles.heading}><div><p>What listeners are moving now</p><h2 id="trending-songs-heading">Trending <TrendingUp size={24}/></h2></div><div className={styles.windows} aria-label="Trending period">{windows.map(item=><button key={item.key} type="button" className={windowKey===item.key?styles.active:''} onClick={()=>setWindowKey(item.key)}>{item.label}</button>)}</div></div>{loading?<div className={styles.loading}>Calculating momentum…</div>:songs.length?<div className={styles.grid}>{songs.map(song=><article className={styles.card} key={song.id}><span className={styles.rank}>#{song.rank}</span><div className={styles.artwork}><ArtworkImage src={song.artwork} alt={`${song.title} artwork`} fill sizes={compact?'90px':'(max-width:700px) 90px, 120px'}/></div><div className={styles.copy}><Link href={`/songs/${song.slug}`} onClick={()=>click(song,'song')}><h3>{song.title}</h3></Link>{song.artistSlug?<Link href={`/artists/${song.artistSlug}`} className={styles.artist} onClick={()=>click(song,'artist')}>{song.artist}</Link>:<p className={styles.artist}>{song.artist}</p>}<span className={styles.duration}>{durationLabel(song.duration)}</span><div className={styles.previewControl}><LatestPlayButton size="small" title={song.title} src={song.previewUrl} analytics={{id:song.id,artistName:song.artist}} discovery={{source:compact?'homepage_trending':'trending_songs',algorithm,position:song.rank}} buttonLabel={compact?'Preview':'Play preview'} showPurchase={false}/></div></div></article>)}</div>:<div className={styles.empty}>Trending data will appear as listeners play, complete, save, share and download Aureon music.</div>}</section>
}
