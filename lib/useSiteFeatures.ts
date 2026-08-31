'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';

export type SiteFeatures = {
  merchandiseEnabled: boolean;
  videosEnabled: boolean;
};

const defaults: SiteFeatures = {
  merchandiseEnabled: false,
  videosEnabled: false
};

export function useSiteFeatures() {
  const [features, setFeatures] = useState<SiteFeatures>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firestore, 'siteSettings', 'platform'),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : null;
        setFeatures({
          merchandiseEnabled: data?.merchandiseEnabled === true,
          videosEnabled: data?.videosEnabled === true
        });
        setLoading(false);
      },
      () => {
        setFeatures(defaults);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return { features, loading };
}
