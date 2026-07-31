'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const HomeFeaturedContent = dynamic(
  () => import('./HomeFeaturedContent').then(module => module.HomeFeaturedContent),
  { ssr: false, loading: () => null },
);

export function DeferredHomeFeaturedContent() {
  const markerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled) return;
    const marker = markerRef.current;
    if (!marker || typeof IntersectionObserver === 'undefined') {
      setEnabled(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setEnabled(true);
          observer.disconnect();
        }
      },
      { rootMargin: '900px 0px' },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [enabled]);

  return (
    <div ref={markerRef} style={{ minHeight: enabled ? undefined : 1 }}>
      {enabled ? <HomeFeaturedContent /> : null}
    </div>
  );
}
