'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

export function FeatureSettings() {
  const [merchandiseEnabled, setMerchandiseEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return onSnapshot(doc(firestore, 'siteSettings', 'features'), (snapshot) => {
      const data = snapshot.data();
      setMerchandiseEnabled(data?.merchandiseEnabled === true);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await setDoc(doc(firestore, 'siteSettings', 'features'), {
        title: 'Website feature visibility',
        slug: 'features',
        status: 'published',
        merchandiseEnabled,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setMessage(merchandiseEnabled
        ? 'Merchandise is now visible on the public website.'
        : 'Merchandise is hidden from the public website.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save website settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Aureon Control Center</p>
        <h1>Website Settings</h1>
        <p>Control which commercial sections are visible to visitors.</p>
      </div>

      {message && <div className="admin-cms-message">{message}</div>}

      <section className="admin-cms-form" style={{ maxWidth: 760 }}>
        <h2>Feature visibility</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'center', padding: '22px 0' }}>
          <div>
            <h3 style={{ margin: '0 0 8px' }}>Merchandise store</h3>
            <p style={{ margin: 0 }}>When switched off, Merch is removed from navigation and merchandise URLs redirect visitors to Music.</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={merchandiseEnabled}
              disabled={loading || saving}
              onChange={(event) => setMerchandiseEnabled(event.target.checked)}
            />
            <strong>{merchandiseEnabled ? 'Visible' : 'Hidden'}</strong>
          </label>
        </div>
        <button className="admin-primary-action" type="button" disabled={loading || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save website settings'}
        </button>
      </section>
    </AdminShell>
  );
}
