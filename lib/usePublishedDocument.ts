'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';

export function usePublishedDocument<T=any>(collectionName:string,slug:string|undefined,fallback:T|null){
 const [data,setData]=useState<T|null>(fallback);
 const [loading,setLoading]=useState(Boolean(slug));
 useEffect(()=>{
  let active=true;setData(fallback);
  if(!slug){setLoading(false);return}
  setLoading(true);
  (async()=>{try{const snap=await getDocs(query(collection(firestore,collectionName),where('slug','==',slug),where('status','==','published'),limit(1)));if(active&&!snap.empty){const raw=snap.docs[0].data() as Record<string,unknown>;const details=raw.details&&typeof raw.details==='object'?raw.details as Record<string,unknown>:{};setData({...((fallback||{}) as object),id:snap.docs[0].id,...raw,...details} as T)}}catch(error){console.error(`Unable to load ${collectionName}/${slug}`,error)}finally{if(active)setLoading(false)}})();
  return()=>{active=false};
 },[collectionName,slug]);
 return{data,loading};
}
