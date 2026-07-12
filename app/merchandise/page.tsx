'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { MerchStore } from '@/components/MerchStore';
import { useSiteFeatures } from '@/lib/useSiteFeatures';

export default function MerchandisePage() {
  const router = useRouter();
  const { features, loading } = useSiteFeatures();

  useEffect(() => {
    if (!loading && !features.merchandiseEnabled) router.replace('/music');
  }, [features.merchandiseEnabled, loading, router]);

  if (loading || !features.merchandiseEnabled) return null;

  return (
    <PageShell title="Merchandise" kicker="Aureon Store">
      <section className="store-intro">
        <div><p className="eyebrow">Official Store</p><h2>Wear the sound.</h2></div>
        <p>Shop official Aureon and artist merchandise including hoodies, T-shirts, caps, posters and limited releases.</p>
      </section>
      <MerchStore />
    </PageShell>
  );
}
