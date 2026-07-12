'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

export type FeatureFlags = {
  merchandiseEnabled: boolean;
};

const defaults: FeatureFlags = {
  merchandiseEnabled: false
};

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlags>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(firestore, 'siteSettings', 'features'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setFlags(defaults);
        } else {
          const data = snapshot.data();
          setFlags({
            merchandiseEnabled: data.merchandiseEnabled === true
          });
        }
        setLoading(false);
      },
      () => {
        setFlags(defaults);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { flags, loading };
}
