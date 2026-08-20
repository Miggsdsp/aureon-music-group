'use client';

import { useEffect } from 'react';
import { DEFAULT_ARTWORK } from '@/lib/get-artwork';

export function GlobalImageFallback() {
  useEffect(() => {
    const handleImageError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (target.dataset.aureonFallbackApplied === '1') return;

      target.dataset.aureonFallbackApplied = '1';
      target.srcset = '';
      target.sizes = '';
      target.src = DEFAULT_ARTWORK;
    };

    document.addEventListener('error', handleImageError, true);
    return () => document.removeEventListener('error', handleImageError, true);
  }, []);

  return null;
}
