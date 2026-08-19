'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

export function DeleteAccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  if (!user) return null;

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Permanently delete your Aureon account? This cannot be undone. Any active Aureon subscription will be cancelled immediately, and your playlists, favourites, listening history and member profile will be removed.',
    );
    if (!confirmed) return;

    const finalConfirmation = window.confirm(
      'Final confirmation: permanently delete this account and remove access to Aureon membership services?',
    );
    if (!finalConfirmation) return;

    setBusy(true);
    setMessage('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete account.');
      await signOut(firebaseAuth).catch(() => undefined);
      window.location.href = '/?account=deleted';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete account. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 1180, margin: '40px auto 96px', padding: '0 24px' }}>
      <div style={{ border: '1px solid rgba(198,163,79,.45)', background: '#070604', padding: '28px', color: '#f5f1e8' }}>
        <p style={{ margin: '0 0 10px', color: '#c6a34f', letterSpacing: '.2em', textTransform: 'uppercase', fontSize: 12, fontWeight: 700 }}>Account controls</p>
        <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px,4vw,34px)' }}>Delete your Aureon account</h2>
        <p style={{ margin: '0 0 20px', color: '#b7b1a7', lineHeight: 1.65, maxWidth: 760 }}>
          Permanently removes your Aureon member profile, playlists, favourites, listening history and access credentials. Any active Aureon subscription will be cancelled immediately. Completed transaction records may be retained where required for accounting, fraud prevention or legal obligations, but they will no longer represent an active website account.
        </p>
        {message && <p style={{ border: '1px solid rgba(198,163,79,.45)', padding: 14, color: '#e7d08c' }}>{message}</p>}
        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy}
          style={{ minHeight: 48, padding: '12px 20px', border: '1px solid #8f4d45', background: 'transparent', color: '#f3c9c3', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .6 : 1 }}
        >
          {busy ? 'Deleting account…' : 'Delete account permanently'}
        </button>
      </div>
    </section>
  );
}
