'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { AdminShell } from '@/components/admin/AdminShell';
import { firestore } from '@/lib/firebase-client';

export default function SettingsPage() {
  const [merchandiseEnabled, setMerchandiseEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return onSnapshot(
      doc(firestore, 'siteSettings', 'platform'),
      (snapshot) => {
        setMerchandiseEnabled(snapshot.exists() && snapshot.data().merchandiseEnabled === true);
        setLoading(false);
      },
      () => {
        setMerchandiseEnabled(false);
        setLoading(false);
      }
    );
  }, []);

  async function updateMerchandiseVisibility(nextValue: boolean) {
    setSaving(true);
    setMessage('');
    try {
      await setDoc(
        doc(firestore, 'siteSettings', 'platform'),
        {
          title: 'Platform settings',
          slug: 'platform',
          status: 'published',
          merchandiseEnabled: nextValue,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      setMerchandiseEnabled(nextValue);
      setMessage(nextValue
        ? 'Merchandise is now visible. Music sales, song previews, cart and checkout remain active.'
        : 'Merchandise is now hidden. Music sales, song previews, cart and checkout remain fully active.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the merchandise setting.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Aureon Control Center</p>
        <h1>Settings</h1>
        <p>Control public website features and operational preferences.</p>
      </div>

      {message && <div className="admin-cms-message">{message}</div>}

      <section className="admin-cms-form" style={{ maxWidth: 920 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 620 }}>
            <p className="admin-kicker">Merchandise visibility only</p>
            <h2 style={{ marginBottom: 10 }}>Merchandise page</h2>
            <p style={{ color: '#a7a7a7', lineHeight: 1.7 }}>
              Keep this switched off until Aureon has merchandise ready. When off, only the Merch link, store icon, homepage merchandise link and merchandise product pages are hidden. Music, albums, song previews, Buy Song buttons, the cart and checkout remain fully available.
            </p>
          </div>

          <button
            type="button"
            className="admin-primary-action"
            disabled={loading || saving}
            onClick={() => updateMerchandiseVisibility(!merchandiseEnabled)}
            aria-pressed={merchandiseEnabled}
            style={{ minWidth: 220 }}
          >
            {loading ? 'Loading…' : saving ? 'Saving…' : merchandiseEnabled ? 'Merchandise: ON' : 'Merchandise: OFF'}
          </button>
        </div>

        <div style={{ marginTop: 24, padding: 18, border: '1px solid rgba(211,171,83,.35)', background: 'rgba(211,171,83,.05)' }}>
          <strong style={{ color: merchandiseEnabled ? '#e5c56f' : '#fff' }}>
            Merchandise status: {merchandiseEnabled ? 'Visible' : 'Hidden'}
          </strong>
          <p style={{ margin: '10px 0 0', color: '#a7a7a7', lineHeight: 1.6 }}>
            Digital music sales are independent from this switch and remain active at all times.
          </p>
        </div>
      </section>
    </AdminShell>
  );
}
