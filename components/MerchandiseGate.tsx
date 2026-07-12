'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFeatureFlags } from '@/lib/useFeatureFlags';

export function MerchandiseGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { flags, loading } = useFeatureFlags();

  useEffect(() => {
    if (!loading && !flags.merchandiseEnabled) {
      router.replace('/music');
    }
  }, [flags.merchandiseEnabled, loading, router]);

  if (loading || !flags.merchandiseEnabled) return null;
  return <>{children}</>;
}
