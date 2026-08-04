'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

const STORAGE_KEY = 'aureon-referral-code';

export function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = String(params.get('ref') || '').trim().toUpperCase();
    if (code) {
      localStorage.setItem(STORAGE_KEY, code);
      if (params.get('mode') === 'signup') window.dispatchEvent(new CustomEvent('aureon-referral-signup-intent'));
    }

    return onAuthStateChanged(firebaseAuth, async user => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!user || !saved) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/member/referrals', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'claim', referralCode: saved }),
        });
        if (response.ok) localStorage.removeItem(STORAGE_KEY);
      } catch {}
    });
  }, []);
  return null;
}
