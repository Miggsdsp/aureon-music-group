'use client';

import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase-client';

export type PublicRecord = DocumentData & { id: string };

export function usePublishedCollection<T extends PublicRecord>(collectionName: string, fallback: T[] = []) {
  const [items, setItems] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const publishedQuery = query(collection(firestore, collectionName), where('status', '==', 'published'));
    const unsubscribe = onSnapshot(
      publishedQuery,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
        setItems(records.length ? records : fallback);
        setLoading(false);
      },
      () => {
        setItems(fallback);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [collectionName]);

  return { items, loading };
}
