'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CORE_ROUTES = ['/artists', '/music', '/videos', '/membership', '/news', '/about'];

export default function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType === '2g') return;

    const prefetch = () => CORE_ROUTES.forEach(route => router.prefetch(route));
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (windowWithIdle.requestIdleCallback) {
      const id = windowWithIdle.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => windowWithIdle.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(prefetch, 1800);
    return () => window.clearTimeout(timer);
  }, [router]);

  return null;
}
