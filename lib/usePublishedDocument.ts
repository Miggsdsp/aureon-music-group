'use client';

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { useInitialPublicCatalogue } from '@/components/catalogue/PublicCatalogueProvider';
import { isPublicContent, normalizePublicRecord } from '@/lib/public-content';

export function usePublishedDocument<T=any>(collectionName:string,slug:string|undefined,fallback:T|null){
 const catalogue = useInitialPublicCatalogue();
 const initial = catalogue?.[collectionName]?.find(record => record.slug === slug || record.id === slug) as T | undefined;
 const [data,setData]=useState<T|null>(initial ?? fallback);
 const [loading,setLoading]=useState(Boolean(slug) && !initial);
 useEffect(()=>{
  let active=true;
  if(!slug){setData(fallback);setLoading(false);return}
  const seed = catalogue?.[collectionName]?.find(record => record.slug === slug || record.id === slug);
  setData((seed as T) ?? fallback);setLoading(!seed);
  (async()=>{try{
   const direct = await getDoc(doc(firestore,collectionName,slug));
   let entry = direct.exists() && isPublicContent(direct.data()) ? direct : null;
   if (!entry) {
    const snap=await getDocs(query(collection(firestore,collectionName),where('slug','==',slug),where('status','==','published'),limit(1)));
    entry = !snap.empty && isPublicContent(snap.docs[0].data()) ? snap.docs[0] : null;
   }
   if(active) {
    const record = entry ? normalizePublicRecord(entry.data(), entry.id) : null;
    // Public catalogue references resolved on the server remain useful for legacy records.
    if (record && seed) for (const key of ['artistSlug','albumSlug']) if (!record[key]) record[key] = seed[key];
    setData(record as T|null);
   }
  }catch(error){console.error(`Unable to load ${collectionName}/${slug}`,error)}finally{if(active)setLoading(false)}})();
  return()=>{active=false};
  // The route provider changes on navigation; array literals are not effect dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[collectionName,slug,catalogue]);
 return{data,loading};
}
