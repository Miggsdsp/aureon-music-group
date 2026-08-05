'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { Crown, Pause, Play, ShoppingBag, ShoppingCart, Sparkles, UserPlus, X } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { trackAnalytics } from '@/lib/track-analytics';
import { trackDiscovery } from '@/lib/discovery-analytics';
import styles from './LatestPlayButton.module.css';

type SongPurchase = { id:string; title:string; artist:string; image:string; price?:number; promotional?:boolean; slug?:string; artistSlug?:string };
type SongAnalytics = { id?:string; artistId?:string; artistName?:string; albumId?:string; albumTitle?:string };
type DiscoveryAnalytics = { source:string; algorithm:string; position:number; confidence?:number };
type CartProduct = { id:string; name:string; slug:string; category:string; artist:string; artistSlug:string; price:number; image:string; description:string; badge?:string; digital?:boolean };
type LatestPlayButtonProps = { title:string; src?:string; purchase?:SongPurchase; analytics?:SongAnalytics; discovery?:DiscoveryAnalytics; buttonLabel?:string; showPurchase?:boolean; size?:'small'|'medium'|'large' };

export function LatestPlayButton({ title, src, purchase, analytics, discovery, buttonLabel, showPurchase = true, size = 'medium' }: LatestPlayButtonProps) {
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const completionTracked=useRef(false);
  const metadataRequested=useRef(false);
  const [isPlaying,setIsPlaying]=useState(false);
  const [hasError,setHasError]=useState(false);
  const [previewFinished,setPreviewFinished]=useState(false);
  const [nearEnd,setNearEnd]=useState(false);
  const [added,setAdded]=useState(false);
  const [signedIn,setSignedIn]=useState(Boolean(firebaseAuth.currentUser));
  const previewSeconds=40;
  const promotional=purchase?.promotional===true;
  const price=purchase?.price??0.99;
  const hasPreview=Boolean(src)&&!hasError;
  const entityId=analytics?.id||purchase?.id||'';
  const artistName=analytics?.artistName||purchase?.artist||'';
  const eventBase={entityType:'song',entityId,title,artistId:analytics?.artistId||'',artistName,albumId:analytics?.albumId||'',albumTitle:analytics?.albumTitle||''};
  const discoveryEntity={id:entityId,type:'song' as const,title,artistId:analytics?.artistId||'',artistName,albumId:analytics?.albumId||'',albumTitle:analytics?.albumTitle||''};
  const songPath=purchase?.slug?`/songs/${purchase.slug}`:entityId?`/songs/${entityId}`:'/music';

  useEffect(()=>onAuthStateChanged(firebaseAuth,user=>setSignedIn(Boolean(user))),[]);
  useEffect(()=>{metadataRequested.current=false;},[src]);

  function requestMetadata(){
    const audio=audioRef.current;
    if(!audio||metadataRequested.current)return;
    metadataRequested.current=true;
    audio.preload='metadata';
    audio.load();
  }

  function trackConversion(conversionType:string){
    if(discovery)trackDiscovery('conversion',discoveryEntity,{...discovery,conversionType});
  }

  function finishPreview(audio:HTMLAudioElement){
    audio.pause();
    if(audio.currentTime>previewSeconds)audio.currentTime=previewSeconds;
    setIsPlaying(false);
    setNearEnd(false);
    setPreviewFinished(true);
    if(completionTracked.current)return;
    completionTracked.current=true;
    trackAnalytics({...eventBase,eventType:'preview_complete',listenedSeconds:Math.min(previewSeconds,audio.duration||previewSeconds),durationSeconds:audio.duration||previewSeconds,progressPercent:audio.duration?Math.min(100,previewSeconds/audio.duration*100):100});
    if(discovery)trackDiscovery('complete',discoveryEntity,discovery,{listenedSeconds:Math.min(previewSeconds,audio.duration||previewSeconds)});
  }

  async function togglePlay(){
    const audio=audioRef.current;
    if(!audio||!hasPreview)return;
    requestMetadata();
    if(isPlaying){
      audio.pause();
      setIsPlaying(false);
      trackAnalytics({...eventBase,eventType:'song_pause',listenedSeconds:audio.currentTime,durationSeconds:audio.duration||0,progressPercent:audio.duration?audio.currentTime/audio.duration*100:0});
      return;
    }
    if(!promotional&&audio.currentTime>=previewSeconds){
      audio.currentTime=0;
      completionTracked.current=false;
    }
    try{
      await audio.play();
      setPreviewFinished(false);
      setNearEnd(false);
      setIsPlaying(true);
      trackAnalytics({...eventBase,eventType:'song_play',listenedSeconds:audio.currentTime,durationSeconds:audio.duration||0});
      if(discovery)trackDiscovery('play',discoveryEntity,{...discovery,interaction:'button'});
    }catch{
      setHasError(true);
      setIsPlaying(false);
    }
  }

  function enforcePreviewLimit(){
    const audio=audioRef.current;
    if(!audio||promotional)return;
    setNearEnd(audio.currentTime>=30&&audio.currentTime<previewSeconds);
    if(audio.currentTime>=previewSeconds)finishPreview(audio);
  }

  function ended(){
    const audio=audioRef.current;
    if(!audio)return;
    setIsPlaying(false);
    if(!promotional){finishPreview(audio);return;}
    trackAnalytics({...eventBase,eventType:'song_complete',listenedSeconds:audio.duration||0,durationSeconds:audio.duration||0,progressPercent:100});
    if(discovery)trackDiscovery('complete',discoveryEntity,discovery,{listenedSeconds:audio.duration||0});
  }

  function addSongToCart(){
    if(!purchase)return;
    const product:CartProduct={id:purchase.id,name:purchase.title,slug:purchase.slug||purchase.id,category:'Digital Music',artist:purchase.artist,artistSlug:purchase.artistSlug||'',price,image:purchase.image,description:`Full digital download of ${purchase.title} by ${purchase.artist}.`,badge:'Digital Download',digital:true};
    const saved=localStorage.getItem('aureon-cart');
    let cart:Array<{product:CartProduct;quantity:number}>=[];
    try{cart=saved?JSON.parse(saved):[]}catch{cart=[]}
    const exists=cart.find(item=>item.product.id===product.id);
    const next=exists?cart.map(item=>item.product.id===product.id?{...item,quantity:item.quantity+1}:item):[...cart,{product,quantity:1}];
    localStorage.setItem('aureon-cart',JSON.stringify(next));
    window.dispatchEvent(new Event('aureon-cart-updated'));
    setAdded(true);
    trackAnalytics({...eventBase,eventType:'song_cart_add'});
    trackConversion('cart_add');
  }

  const defaultLabel=promotional?`Play: ${title}`:`40s Preview: ${title}`;
  return <div className="song-commerce-control">
    {hasPreview?<button className={`latest-release latest-release-button ${styles.button} ${styles[size]}`} type="button" onPointerEnter={requestMetadata} onFocus={requestMetadata} onTouchStart={requestMetadata} onClick={togglePlay}>{isPlaying?<Pause size={13}/>:<Play size={13}/>} {isPlaying?'Pause':buttonLabel||defaultLabel}</button>:<span className="preview-ended-message">Preview coming soon.</span>}
    {showPurchase&&!promotional&&purchase&&<div className="song-buy-row"><button type="button" className="song-buy-button" onClick={addSongToCart}><ShoppingCart size={14}/> {added?'Added to cart':`Buy full song €${price.toFixed(2)}`}</button>{added&&<Link href="/checkout">Checkout →</Link>}</div>}
    {src?<audio ref={audioRef} src={src} preload="none" crossOrigin="anonymous" onTimeUpdate={enforcePreviewLimit} onEnded={ended} onError={()=>setHasError(true)}/>:null}

    {nearEnd&&!previewFinished&&!promotional&&<div className={styles.benefitCue} role="status"><Sparkles size={15}/><div><strong>Keep the music going</strong><span>Premium unlocks the complete Aureon catalogue.</span></div></div>}

    {previewFinished&&!promotional&&<div className={styles.conversionBackdrop} role="dialog" aria-modal="true" aria-labelledby={`preview-conversion-${entityId||'song'}`} onMouseDown={event=>{if(event.target===event.currentTarget)setPreviewFinished(false)}}>
      <section className={styles.conversionPanel}>
        <button type="button" className={styles.close} onClick={()=>setPreviewFinished(false)} aria-label="Close preview options"><X/></button>
        <p className={styles.eyebrow}>Your preview has finished</p>
        <h2 id={`preview-conversion-${entityId||'song'}`}>{title}</h2>
        <p className={styles.intro}>Choose how you would like to continue your Aureon journey.</p>
        <div className={styles.conversionGrid}>
          <Link className={`${styles.option} ${styles.primaryOption}`} href="/membership" onClick={()=>trackConversion('premium_membership')}><Crown/><div><strong>Continue Listening</strong><span>Become an Aureon Premium Member and hear the complete catalogue.</span></div><b>Explore Premium →</b></Link>
          <Link className={styles.option} href={signedIn?'/account':'/account?mode=signup'} onClick={()=>trackConversion(signedIn?'account_dashboard':'free_account')}><UserPlus/><div><strong>{signedIn?'Open Your Account':'Create Free Account'}</strong><span>{signedIn?'Save favourites, playlists and listening history.':'Save favourites and continue your music journey.'}</span></div><b>{signedIn?'Open account →':'Join free →'}</b></Link>
          {purchase?<button type="button" className={styles.option} onClick={addSongToCart}><ShoppingBag/><div><strong>Purchase This Song</strong><span>Own this track permanently as a digital download.</span></div><b>{added?'Added — View cart':'Buy for €'+price.toFixed(2)}</b></button>:<Link className={styles.option} href={songPath} onClick={()=>trackConversion('purchase_song')}><ShoppingBag/><div><strong>Purchase This Song</strong><span>Visit the song page to own this track permanently.</span></div><b>View song →</b></Link>}
        </div>
        {added&&<Link className={styles.checkout} href="/checkout">Continue to secure checkout →</Link>}
        <button type="button" className={styles.replay} onClick={()=>{setPreviewFinished(false);void togglePlay()}}>Replay the 40-second preview</button>
      </section>
    </div>}
  </div>;
}
