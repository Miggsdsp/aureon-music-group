'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Pause, Play, ShoppingCart } from 'lucide-react';
import { trackAnalytics } from '@/lib/track-analytics';

type SongPurchase = { id:string; title:string; artist:string; image:string; price?:number; promotional?:boolean; slug?:string; artistSlug?:string };
type SongAnalytics = { id?:string; artistId?:string; artistName?:string; albumId?:string; albumTitle?:string };
type CartProduct = { id:string; name:string; slug:string; category:string; artist:string; artistSlug:string; price:number; image:string; description:string; badge?:string; digital?:boolean };

export function LatestPlayButton({ title, src, purchase, analytics }: { title:string; src?:string; purchase?:SongPurchase; analytics?:SongAnalytics }) {
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [isPlaying,setIsPlaying]=useState(false);const[hasError,setHasError]=useState(false);const[previewFinished,setPreviewFinished]=useState(false);const[added,setAdded]=useState(false);
  const previewSeconds=40;const promotional=purchase?.promotional===true;const price=purchase?.price??0.99;const hasPreview=Boolean(src)&&!hasError;
  const eventBase={entityType:'song',entityId:analytics?.id||purchase?.id||'',title,artistId:analytics?.artistId||'',artistName:analytics?.artistName||purchase?.artist||'',albumId:analytics?.albumId||'',albumTitle:analytics?.albumTitle||''};

  async function togglePlay(){const audio=audioRef.current;if(!audio||!hasPreview)return;if(isPlaying){audio.pause();setIsPlaying(false);trackAnalytics({...eventBase,eventType:'song_pause',listenedSeconds:audio.currentTime,durationSeconds:audio.duration||0,progressPercent:audio.duration?audio.currentTime/audio.duration*100:0});return;}if(!promotional&&audio.currentTime>=previewSeconds)audio.currentTime=0;try{await audio.play();setPreviewFinished(false);setIsPlaying(true);trackAnalytics({...eventBase,eventType:'song_play',listenedSeconds:audio.currentTime,durationSeconds:audio.duration||0});}catch{setHasError(true);setIsPlaying(false)}}
  function enforcePreviewLimit(){const audio=audioRef.current;if(!audio||promotional)return;if(audio.currentTime>=previewSeconds){audio.pause();audio.currentTime=previewSeconds;setIsPlaying(false);setPreviewFinished(true);trackAnalytics({...eventBase,eventType:'preview_complete',listenedSeconds:previewSeconds,durationSeconds:audio.duration||previewSeconds,progressPercent:audio.duration?previewSeconds/audio.duration*100:100});}}
  function ended(){const audio=audioRef.current;setIsPlaying(false);trackAnalytics({...eventBase,eventType:'song_complete',listenedSeconds:audio?.duration||0,durationSeconds:audio?.duration||0,progressPercent:100});}
  function addSongToCart(){if(!purchase)return;const product:CartProduct={id:purchase.id,name:purchase.title,slug:purchase.slug||purchase.id,category:'Digital Music',artist:purchase.artist,artistSlug:purchase.artistSlug||'',price,image:purchase.image,description:`Full digital download of ${purchase.title} by ${purchase.artist}.`,badge:'Digital Download',digital:true};const saved=localStorage.getItem('aureon-cart');let cart:Array<{product:CartProduct;quantity:number}>=[];try{cart=saved?JSON.parse(saved):[]}catch{cart=[]}const exists=cart.find(item=>item.product.id===product.id);const next=exists?cart.map(item=>item.product.id===product.id?{...item,quantity:item.quantity+1}:item):[...cart,{product,quantity:1}];localStorage.setItem('aureon-cart',JSON.stringify(next));window.dispatchEvent(new Event('aureon-cart-updated'));setAdded(true);trackAnalytics({...eventBase,eventType:'song_cart_add'});}

  return <div className="song-commerce-control">{hasPreview?<button className="latest-release latest-release-button" type="button" onClick={togglePlay}>{isPlaying?<Pause size={13}/>:<Play size={13}/>} {promotional?`Play: ${title}`:`40s Preview: ${title}`}</button>:<span className="preview-ended-message">Preview coming soon.</span>}{!promotional&&purchase&&<div className="song-buy-row"><button type="button" className="song-buy-button" onClick={addSongToCart}><ShoppingCart size={14}/> {added?'Added to cart':`Buy full song €${price.toFixed(2)}`}</button>{added&&<Link href="/checkout">Checkout →</Link>}</div>}{previewFinished&&!promotional&&<p className="preview-ended-message">Preview finished. Purchase the full song to download it.</p>}{src?<audio ref={audioRef} src={src} preload="metadata" onTimeUpdate={enforcePreviewLimit} onEnded={ended} onError={()=>setHasError(true)}/>:null}</div>;
}
