'use client';

import { useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { invalidatePublishedContent } from '@/lib/cache-invalidation-client';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

const WATCHED = ['artists', 'albums', 'songs', 'videoAlbums', 'videos', 'newsArticles'] as const;

export function AdminCacheInvalidationBridge() {
  const { authorised, loading } = useAdminAuth();

  useEffect(() => {
    if (loading || !authorised) return;
    const initialised = new Set<string>();
    const timers = new Map<string, number>();

    const unsubs = WATCHED.map(collectionName => onSnapshot(
      collection(firestore, collectionName),
      snapshot => {
        if (!initialised.has(collectionName)) {
          initialised.add(collectionName);
          return;
        }
        const changed = snapshot.docChanges();
        if (!changed.length) return;
        const publishedChange = changed.find(change => {
          const data = change.doc.data();
          return change.type === 'removed' || data.status === 'published' || data.status === 'draft';
        });
        if (!publishedChange) return;
        const data = publishedChange.doc.data();
        const slug = String(data.slug || publishedChange.doc.id);
        const existing = timers.get(collectionName);
        if (existing) window.clearTimeout(existing);
        timers.set(collectionName, window.setTimeout(() => {
          void invalidatePublishedContent(collectionName, slug);
          timers.delete(collectionName);
        }, 500));
      },
      () => undefined,
    ));

    return () => {
      unsubs.forEach(unsub => unsub());
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [authorised, loading]);

  return null;
}
