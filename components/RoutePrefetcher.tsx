'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CORE_ROUTES = ['/artists', '/music', '/videos', '/membership', '/news', '/about'];

export default function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const effectiveType = connection?.effectiveType;
    if (connection?.saveData || effectiveType === '2g' || effectiveType === '3g') return;

    const prefetch = () => CORE_ROUTES.forEach(route => router.prefetch(route));
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    // Keep navigation prefetching, but let the current page finish its critical
    // network and rendering work first. This is especially important on mobile 5G,
    // where six eager route prefetches can compete with images, Firebase and audio.
    if (windowWithIdle.requestIdleCallback) {
      const id = windowWithIdle.requestIdleCallback(prefetch, { timeout: 6000 });
      return () => windowWithIdle.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(prefetch, 5000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
