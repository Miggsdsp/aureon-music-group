'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';

export function usePublishedDocument(collectionName:string,slug:string|undefined,fallback:any){
 const [data,setData]=useState<any>(fallback);
 const [loading,setLoading]=useState(Boolean(slug));
 useEffect(()=>{
  let active=true;setData(fallback);
  if(!slug){setLoading(false);return}
  setLoading(true);
  (async()=>{try{const snap=await getDocs(query(collection(firestore,collectionName),where('slug','==',slug),where('status','==','published'),limit(1)));if(active&&!snap.empty){const raw=snap.docs[0].data() as any;const details=raw.details&&typeof raw.details==='object'?raw.details:{};setData({...fallback,id:snap.docs[0].id,...raw,...details})}}catch(error){console.error(`Unable to load ${collectionName}/${slug}`,error)}finally{if(active)setLoading(false)}})();
  return()=>{active=false};
 },[collectionName,slug]);
 return{data,loading};
}
