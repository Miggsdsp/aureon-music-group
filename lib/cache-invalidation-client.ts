'use client';

import { firebaseAuth } from '@/lib/firebase-client';

export async function invalidatePublishedContent(collectionName: string, slug?: string, paths: string[] = []) {
  const user = firebaseAuth.currentUser;
  if (!user) return false;
  const token = await user.getIdToken();
  const response = await fetch('/api/cache/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ collectionName, slug, paths }),
    cache: 'no-store',
  });
  return response.ok;
}
