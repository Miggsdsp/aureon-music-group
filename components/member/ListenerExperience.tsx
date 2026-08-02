'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Download, Heart, History, Play, RotateCcw, Star } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import './listener-experience.css';

type Activity={favouriteSongIds:string[];favouriteArtists:string[];continueListening:any;recentlyPlayed:any[];downloadHistory:any[];downloadsUsed:number;downloadLimit:number;resetDate:string|null};
const emptyActivity:Activity={favouriteSongIds:[],favouriteArtists:[],continueListening:null,recentlyPlayed:[],downloadHistory:[],downloadsUsed:0,downloadLimit:5,resetDate:null};

export default function ListenerExperience(){
 const{playSong}=useMusicPlayer();const[user,setUser]=useState<User|null>(null);const[songs,setSongs]=useState<PlayerSong[]>([]);const[activity,setActivity]=useState<Activity>(emptyActivity);const[loading,setLoading]=useState(true);const[message,setMessage]=useState('');
 useEffect(()=>onAuthStateChanged(firebaseAuth,setUser),[]);
 useEffect(()=>{if(!user)return;const published=query(collection(firestore,'songs'),where('status','==','published'));return onSnapshot(published,snapshot=>setSongs(snapshot.docs.map(item=>({id:item.id,...item.data()} as PlayerSong))))},[user]);
 const request=useCallback(async(body?:Record<string,unknown>)=>{if(!user)return null;const token=await user.getIdToken();const response=await fetch('/api/member/library',{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load your library activity.');return data},[user]);
 const refresh=useCallback(async()=>{if(!user)return;try{setActivity(await request() as Activity);setMessage('')}catch(error){setMessage(error instanceof Error?error.message:'Unable to load your library activity.')}finally{setLoading(false)}},[request,user]);
 useEffect(()=>{void refresh()},[refresh]);
 const songMap=useMemo(()=>new Map(songs.map(song=>[song.id,song])),[songs]);
 const favouriteSongs=activity.favouriteSongIds.map(id=>songMap.get(id)).filter(Boolean) as PlayerSong[];
 const artists=useMemo(()=>Array.from(new Set(songs.map(song=>song.artistName||song.artist).filter(Boolean) as string[])).sort(),[songs]);
 const remaining=Math.max(0,activity.downloadLimit-activity.downloadsUsed);
 const reset=activity.resetDate?new Date(activity.resetDate).toLocaleDateString('en-IE',{day:'numeric',month:'long',year:'numeric'}):'your next billing date';
 async function toggleSong(songId:string){try{await request({action:'toggle-song',songId});await refresh()}catch(error){setMessage(error instanceof Error?error.message:'Unable to update favourite.')}}
 async function toggleArtist(artist:string){try{await request({action:'toggle-artist',artist});await refresh()}catch(error){setMessage(error instanceof Error?error.message:'Unable to update favourite artist.')}}
 if(!user)return null;
 return <section className="listener-experience" aria-label="Listener membership benefits">
  <div className="listener-benefit-head"><div><p>Listener membership</p><h2>Your personal library</h2></div><div className="download-allowance"><strong>{remaining}</strong><span>monthly downloads remaining</span><small>Five distinct songs per billing month · resets {reset}</small></div></div>
  {message&&<div className="listener-notice">{message}</div>}
  {loading?<div className="listener-loading">Loading your listening activity…</div>:<>
   {activity.continueListening?.songId&&songMap.get(activity.continueListening.songId)&&<article className="continue-card"><RotateCcw/><div><small>Continue listening</small><strong>{activity.continueListening.title||'Aureon track'}</strong><span>{activity.continueListening.artist}</span></div><button onClick={()=>playSong(songMap.get(activity.continueListening.songId)!)}><Play/> Resume</button></article>}
   <div className="listener-columns"><div className="listener-panel"><h3><History/> Recently played</h3>{activity.recentlyPlayed.length?activity.recentlyPlayed.slice(0,8).map(item=><button className="history-row" key={item.id} onClick={()=>songMap.get(item.songId)&&playSong(songMap.get(item.songId)!)}><span><strong>{item.title||'Untitled track'}</strong><small>{item.artist||'Aureon Music Group'}</small></span><Play/></button>):<p>No listening history yet. Play a track to begin.</p>}</div><div className="listener-panel"><h3><Download/> Download history</h3>{activity.downloadHistory.length?activity.downloadHistory.slice(0,10).map(item=><div className="history-row static" key={item.id}><span><strong>{item.songTitle||'Untitled track'}</strong><small>{item.reDownload?'Re-downloaded':'Downloaded'} · {item.createdAt?new Date(item.createdAt).toLocaleDateString('en-IE'):''}</small></span></div>):<p>No member downloads yet.</p>}</div></div>
   <div className="listener-columns"><div className="listener-panel"><h3><Heart/> Favourite songs</h3><div className="favourite-grid">{songs.map(song=>{const active=activity.favouriteSongIds.includes(song.id);return <button className={active?'active':''} key={song.id} onClick={()=>toggleSong(song.id)}><Heart fill={active?'currentColor':'none'}/><span><strong>{song.title||'Untitled track'}</strong><small>{song.artistName||song.artist||'Aureon Music Group'}</small></span></button>})}</div>{!favouriteSongs.length&&<p>Select the heart beside a track to build your favourites.</p>}</div><div className="listener-panel"><h3><Star/> Favourite artists</h3><div className="artist-chips">{artists.map(artist=>{const active=activity.favouriteArtists.includes(artist);return <button className={active?'active':''} key={artist} onClick={()=>toggleArtist(artist)}><Star fill={active?'currentColor':'none'}/>{artist}</button>})}</div></div></div>
  </>}
 </section>
}
