'use client';

import { useEffect } from 'react';
import { trackAnalytics } from '@/lib/track-analytics';

export default function GrowthAnalyticsBridge() {
  useEffect(() => {
    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.eventType) trackAnalytics(detail);
    };
    window.addEventListener('aureon-analytics', onCustom);
    return () => {
      window.removeEventListener('aureon-analytics', onCustom);
    };
  }, []);
  return null;
}
