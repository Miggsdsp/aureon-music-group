'use client';

import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useInitialPublicCatalogue } from '@/components/catalogue/PublicCatalogueProvider';
import { matchesAlbum, matchesArtist } from '@/lib/public-catalogue';
import { isPublicContent, normalizePublicRecord } from '@/lib/public-content';
import { firestore } from '@/lib/firebase-client';

export type PublicRecord = DocumentData & { id: string };

export function usePublishedCollection<T extends PublicRecord>(collectionName: string, fallback: T[] = [], useServerBaseline = false) {
  const catalogue = useInitialPublicCatalogue();
  const initial = useServerBaseline ? catalogue?.[collectionName] as T[] | undefined : undefined;
  const [items, setItems] = useState<T[]>(initial ?? fallback);
  const [loading, setLoading] = useState(initial === undefined);

  useEffect(() => {
    const publishedQuery = query(collection(firestore, collectionName), where('status', '==', 'published'));
    const unsubscribe = onSnapshot(
      publishedQuery,
      (snapshot) => {
        const records = snapshot.docs.filter(entry => isPublicContent(entry.data())).map(entry => normalizePublicRecord(entry.data(), entry.id) as T);
        for (const record of records) {
          const artist = catalogue?.artists?.find(item => matchesArtist(record, item));
          if (artist) (record as Record<string, any>).artistSlug = artist.slug;
          const album = catalogue?.albums?.find(item => matchesAlbum(record, item));
          if (album && collectionName === 'songs') (record as Record<string, any>).albumSlug = album.slug;
        }
        setItems(records);
        setLoading(false);
      },
      () => {
        // A temporary network failure must not erase the server-rendered baseline.
        setLoading(false);
      }
    );
    return unsubscribe;
    // Fallback values are intentionally not dependencies; callers commonly pass array literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { items, loading };
}
