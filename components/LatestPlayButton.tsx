'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { Crown, Pause, Play, ShoppingBag, ShoppingCart, Sparkles, UserPlus, X } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { trackAnalytics } from '@/lib/track-analytics';
import { trackDiscovery } from '@/lib/discovery-analytics';
import styles from './LatestPlayButton.module.css';

type SongPurchase = { id:string; title:string; artist:string; image:string; price?:number; promotional?:boolean; slug?:string; artistSlug?:string };
type SongAnalytics = { id?:string; slug?:string; genre?:string; artistId?:string; artistSlug?:string; artistName?:string; albumId?:string; albumSlug?:string; albumTitle?:string };
type DiscoveryAnalytics = { source:string; algorithm:string; position:number; confidence?:number };
type CartProduct = { id:string; name:string; slug:string; category:string; artist:string; artistSlug:string; price:number; image:string; description:string; badge?:string; digital?:boolean };
type LatestPlayButtonProps = { title:string; src?:string; artwork?:string; purchase?:SongPurchase; analytics?:SongAnalytics; discovery?:DiscoveryAnalytics; buttonLabel?:string; showPurchase?:boolean; size?:'small'|'medium'|'large' };

const DEFAULT_MEDIA_ARTWORK = '/images/branding/Aureon_Header_Logo.png';

function mediaArtwork(source?: string) {
  if (typeof window === 'undefined') return DEFAULT_MEDIA_ARTWORK;
  const raw = source || DEFAULT_MEDIA_ARTWORK;
  let absolute = '';
  try { absolute = new URL(raw, window.location.origin).href; }
  catch { absolute = new URL(DEFAULT_MEDIA_ARTWORK, window.location.origin).href; }
  return new URL(`/api/media/artwork?src=${encodeURIComponent(absolute)}`, window.location.origin).href;
}

function clickAdjacentPreview(button: HTMLButtonElement | null, direction: 1 | -1) {
  if (typeof document === 'undefined' || !button) return false;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-aureon-preview-button="true"]')).filter(item => !item.disabled);
  const current = buttons.indexOf(button);
  if (current === -1 || buttons.length < 2) return false;
  const next = buttons[current + direction] || buttons[direction > 0 ? 0 : buttons.length - 1];
  next.click();
  try { next.focus({ preventScroll: true }); } catch {}
  return true;
}

export function LatestPlayButton({ title, src, artwork, purchase, analytics, discovery, buttonLabel, showPurchase = true, size = 'medium' }: LatestPlayButtonProps) {
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const buttonRef=useRef<HTMLButtonElement|null>(null);
  const completionTracked=useRef(false);
  const startTracked=useRef(false);
  const milestonesTracked=useRef(new Set<number>());
  const metadataRequested=useRef(false);
  const earlyEndedRetries=useRef(0);
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
  const mediaArtworkSource=artwork||purchase?.image||'';
  const eventBase={entityType:'song',entityId,title,slug:analytics?.slug||purchase?.slug||'',genre:analytics?.genre||'',artistId:analytics?.artistId||'',artistSlug:analytics?.artistSlug||purchase?.artistSlug||'',artistName,albumId:analytics?.albumId||'',albumSlug:analytics?.albumSlug||'',albumTitle:analytics?.albumTitle||''};
  const discoveryEntity={id:entityId,type:'song' as const,title,artistId:analytics?.artistId||'',artistName,albumId:analytics?.albumId||'',albumTitle:analytics?.albumTitle||''};
  const songPath=purchase?.slug?`/songs/${purchase.slug}`:entityId?`/songs/${entityId}`:'/music';

  useEffect(()=>onAuthStateChanged(firebaseAuth,user=>setSignedIn(Boolean(user))),[]);
  useEffect(()=>{
    metadataRequested.current=false;
    completionTracked.current=false;
    startTracked.current=false;
    milestonesTracked.current.clear();
    earlyEndedRetries.current=0;
    setHasError(false);
    setIsPlaying(false);
    setNearEnd(false);
    setPreviewFinished(false);
  },[src]);
  useEffect(()=>{
    if(!previewFinished||typeof document==='undefined')return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=previousOverflow;};
  },[previewFinished]);

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

  function updateMediaSession(state: MediaSessionPlaybackState = 'playing'){
    if(typeof navigator==='undefined'||!('mediaSession' in navigator))return;
    try{
      const mediaSession=navigator.mediaSession;
      const image=mediaArtwork(mediaArtworkSource);
      mediaSession.metadata=new MediaMetadata({
        title:title||'Aureon Music Group',
        artist:artistName||'Aureon Music Group',
        album:analytics?.albumTitle||'Aureon Music Group',
        artwork:[
          {src:image,sizes:'512x512'},
          {src:image,sizes:'256x256'},
          {src:image,sizes:'128x128'},
          {src:image,sizes:'96x96'},
        ],
      });
      mediaSession.playbackState=state;
      const setHandler=(action:MediaSessionAction,handler:MediaSessionActionHandler|null)=>{
        try{mediaSession.setActionHandler(action,handler)}catch{}
      };
      setHandler('play',async()=>{const audio=audioRef.current;if(!audio)return;try{await audio.play();setIsPlaying(true);updateMediaSession('playing')}catch{}});
      setHandler('pause',()=>{audioRef.current?.pause();setIsPlaying(false);updateMediaSession('paused')});
      setHandler('previoustrack',()=>{if(!clickAdjacentPreview(buttonRef.current,-1)){const audio=audioRef.current;if(audio)audio.currentTime=0;}});
      setHandler('nexttrack',()=>{clickAdjacentPreview(buttonRef.current,1)});
      setHandler('seekbackward',null);
      setHandler('seekforward',null);
      setHandler('seekto',null);
    }catch{}
  }

  function pauseMediaSession(){
    if(typeof navigator==='undefined'||!('mediaSession' in navigator))return;
    try{navigator.mediaSession.playbackState='paused'}catch{}
  }

  function pauseOtherPreviews(audio: HTMLAudioElement){
    if(typeof document==='undefined')return;
    document.querySelectorAll<HTMLAudioElement>('audio[data-aureon-preview-audio="true"]').forEach(item=>{
      if(item!==audio)item.pause();
    });
  }

  function finishPreview(audio:HTMLAudioElement){
    audio.pause();
    if(audio.currentTime>previewSeconds)audio.currentTime=previewSeconds;
    setIsPlaying(false);
    setNearEnd(false);
    pauseMediaSession();
    setPreviewFinished(true);
    if(completionTracked.current)return;
    completionTracked.current=true;
    trackAnalytics({...eventBase,eventType:'music_preview_complete',listenedSeconds:Math.min(previewSeconds,audio.duration||previewSeconds),durationSeconds:Math.min(previewSeconds,audio.duration||previewSeconds),progressPercent:100});
    if(discovery)trackDiscovery('complete',discoveryEntity,discovery,{listenedSeconds:Math.min(previewSeconds,audio.duration||previewSeconds)});
  }

  async function togglePlay(){
    const audio=audioRef.current;
    if(!audio||!hasPreview)return;
    requestMetadata();
    if(isPlaying){
      audio.pause();
      setIsPlaying(false);
      updateMediaSession('paused');
      trackAnalytics({...eventBase,eventType:'song_pause',listenedSeconds:audio.currentTime,durationSeconds:audio.duration||0,progressPercent:audio.duration?audio.currentTime/audio.duration*100:0});
      return;
    }
    if(!promotional&&audio.currentTime>=previewSeconds){
      audio.currentTime=0;
      completionTracked.current=false;
      startTracked.current=false;
      milestonesTracked.current.clear();
      earlyEndedRetries.current=0;
    }
    try{
      pauseOtherPreviews(audio);
      await audio.play();
      updateMediaSession('playing');
      setPreviewFinished(false);
      setNearEnd(false);
      setIsPlaying(true);
      if(!startTracked.current){startTracked.current=true;trackAnalytics({...eventBase,eventType:'music_preview_start',listenedSeconds:audio.currentTime,durationSeconds:Math.min(previewSeconds,audio.duration||previewSeconds)})}
      if(discovery)trackDiscovery('play',discoveryEntity,{...discovery,interaction:'button'});
    }catch(error){
      console.error('Aureon preview playback failed',error);
      setHasError(true);
      setIsPlaying(false);
    }
  }

  function enforcePreviewLimit(){
    const audio=audioRef.current;
    if(!audio||promotional)return;
    const percent=Math.min(100,audio.currentTime/previewSeconds*100);
    for(const milestone of [25,50,75])if(percent>=milestone&&!milestonesTracked.current.has(milestone)){milestonesTracked.current.add(milestone);trackAnalytics({...eventBase,eventType:'music_preview_progress',listenedSeconds:audio.currentTime,durationSeconds:previewSeconds,progressPercent:milestone})}
    setNearEnd(audio.currentTime>=30&&audio.currentTime<previewSeconds);
    if(audio.currentTime>=previewSeconds)finishPreview(audio);
  }

  function ended(){
    const audio=audioRef.current;
    if(!audio)return;
    if(!promotional&&audio.currentTime<previewSeconds-0.75){
      setIsPlaying(false);
      setNearEnd(false);
      pauseMediaSession();
      if(earlyEndedRetries.current<1&&(Number.isFinite(audio.duration)?audio.duration>=previewSeconds-0.75:true)){
        earlyEndedRetries.current+=1;
        const resumeAt=audio.currentTime;
        audio.currentTime=resumeAt;
        audio.play().then(()=>{setIsPlaying(true);updateMediaSession('playing')}).catch(error=>{
          console.error('Aureon preview resume failed after early ended event',error);
        });
      }
      return;
    }
    setIsPlaying(false);
    pauseMediaSession();
    if(!promotional){finishPreview(audio);return;}
    trackAnalytics({...eventBase,eventType:'music_preview_complete',listenedSeconds:audio.duration||0,durationSeconds:audio.duration||0,progressPercent:100});
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

  const conversionModal=previewFinished&&!promotional&&typeof document!=='undefined'?createPortal(
    <div className={styles.conversionBackdrop} role="dialog" aria-modal="true" aria-labelledby={`preview-conversion-${entityId||'song'}`} onMouseDown={event=>{if(event.target===event.currentTarget)setPreviewFinished(false)}}>
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
    </div>,
    document.body,
  ):null;

  const defaultLabel=promotional?`Play: ${title}`:`40s Preview: ${title}`;
  return <div className="song-commerce-control">
    {hasPreview?<button ref={buttonRef} data-aureon-preview-button="true" className={`latest-release latest-release-button ${styles.button} ${styles[size]}`} type="button" onPointerEnter={requestMetadata} onFocus={requestMetadata} onTouchStart={requestMetadata} onClick={togglePlay}>{isPlaying?<Pause size={13}/>:<Play size={13}/>} {isPlaying?'Pause':buttonLabel||defaultLabel}</button>:<span className="preview-ended-message">Preview coming soon.</span>}
    {showPurchase&&!promotional&&purchase&&<div className="song-buy-row"><button type="button" className="song-buy-button" onClick={addSongToCart}><ShoppingCart size={14}/> {added?'Added to cart':`Buy full song €${price.toFixed(2)}`}</button>{added&&<Link href="/checkout">Checkout →</Link>}</div>}
    {src?<audio ref={audioRef} data-aureon-preview-audio="true" src={src} preload="none" playsInline onCanPlay={()=>setHasError(false)} onTimeUpdate={enforcePreviewLimit} onEnded={ended} onPause={()=>setIsPlaying(false)} onError={()=>setHasError(true)}/>:null}
    {nearEnd&&!previewFinished&&!promotional&&<div className={styles.benefitCue} role="status"><Sparkles size={15}/><div><strong>Keep the music going</strong><span>Premium unlocks the complete Aureon catalogue.</span></div></div>}
    {conversionModal}
  </div>;
}
