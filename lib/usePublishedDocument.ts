'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export function usePublishedDocument<T extends Record<string, unknown>>(collectionName: string, slug: string | undefined, fallback: T | null) {
  const [data, setData] = useState<T | null>(fallback);
  const [loading, setLoading] = useState(Boolean(slug));

  useEffect(() => {
    let active = true;
    if (!slug) { setLoading(false); return; }
    const run = async () => {
      try {
        const snap = await getDocs(query(collection(firestore, collectionName), where('slug', '==', slug), where('status', '==', 'published'), limit(1)));
        if (active && !snap.empty) setData({ id: snap.docs[0].id, ...snap.docs[0].data() } as T);
      } catch (error) {
        console.error(`Unable to load ${collectionName}/${slug}`, error);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [collectionName, slug]);

  return { data, loading };
}
