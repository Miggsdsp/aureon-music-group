'use client';

import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { invalidatePublishedContent } from '@/lib/cache-invalidation-client';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

const WATCHED=['artists','albums','songs','videoAlbums','videos','newsArticles','publicPlaylists'] as const;
async function updateSearchIndex(body:Record<string,string>){const user=firebaseAuth.currentUser;if(!user)return;const token=await user.getIdToken();await fetch('/api/admin/search-index',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body),keepalive:true})}
export function AdminCacheInvalidationBridge(){const{authorised,loading}=useAdminAuth();useEffect(()=>{if(loading||!authorised)return;const initialised=new Set<string>();const timers=new Map<string,number>();void updateSearchIndex({action:'ensure'});const unsubs=WATCHED.map(collectionName=>onSnapshot(collection(firestore,collectionName),snapshot=>{if(!initialised.has(collectionName)){initialised.add(collectionName);return}const changed=snapshot.docChanges();if(!changed.length)return;const relevant=changed.filter(change=>{const data=change.doc.data();return change.type==='removed'||data.status==='published'||data.status==='draft'||collectionName==='publicPlaylists'});if(!relevant.length)return;const existing=timers.get(collectionName);if(existing)window.clearTimeout(existing);timers.set(collectionName,window.setTimeout(()=>{for(const change of relevant){const data=change.doc.data();const slug=String(data.slug||change.doc.id);void invalidatePublishedContent(collectionName,slug);void updateSearchIndex({collection:collectionName,id:change.doc.id})}timers.delete(collectionName)},600))},()=>undefined));return()=>{unsubs.forEach(unsub=>unsub());timers.forEach(timer=>window.clearTimeout(timer))}},[authorised,loading]);return null}
