'use client';

import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { firestore } from '@/lib/firebase-client';

export type PublicRecord = DocumentData & { id: string };

function isReleased(record: DocumentData) {
  const value = record.publishAt || record.scheduledAt;
  if (!value) return true;
  const date = value?.toDate?.() || new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
}

export function usePublishedCollection<T extends PublicRecord>(collectionName: string, fallback: T[] = []) {
  const [items, setItems] = useState<T[]>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const publishedQuery = query(collection(firestore, collectionName), where('status', '==', 'published'));
    const unsubscribe = onSnapshot(
      publishedQuery,
      (snapshot) => {
        const records = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as T)).filter(isReleased);
        setItems(records.length ? records : fallback);
        setLoading(false);
      },
      () => {
        setItems(fallback);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [collectionName, fallback]);

  return { items, loading };
}
