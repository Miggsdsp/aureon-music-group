'use client';

import { FormEvent, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { AdminShell } from '@/components/admin/AdminShell';
import { firebaseAuth, firestore } from '@/lib/firebase-client';

type SocialSettings = {
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  xUrl: string;
  spotifyUrl: string;
  appleMusicUrl: string;
};

const defaults: SocialSettings = {
  facebookUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
  xUrl: '',
  spotifyUrl: '',
  appleMusicUrl: ''
};

const fields: Array<{ key: keyof SocialSettings; label: string; placeholder: string }> = [
  { key: 'facebookUrl', label: 'Facebook', placeholder: 'https://www.facebook.com/...' },
  { key: 'instagramUrl', label: 'Instagram', placeholder: 'https://www.instagram.com/...' },
  { key: 'tiktokUrl', label: 'TikTok', placeholder: 'https://www.tiktok.com/@...' },
  { key: 'youtubeUrl', label: 'YouTube', placeholder: 'https://www.youtube.com/@...' },
  { key: 'xUrl', label: 'X', placeholder: 'https://x.com/...' },
  { key: 'spotifyUrl', label: 'Spotify', placeholder: 'https://open.spotify.com/...' },
  { key: 'appleMusicUrl', label: 'Apple Music', placeholder: 'https://music.apple.com/...' }
];

export default function SocialMediaPage() {
  const [settings, setSettings] = useState<SocialSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onSnapshot(doc(firestore, 'siteSettings', 'platform'), snapshot => {
    const data = snapshot.exists() ? snapshot.data() : {};
    setSettings({
      facebookUrl: String(data.facebookUrl || ''),
      instagramUrl: String(data.instagramUrl || ''),
      tiktokUrl: String(data.tiktokUrl || ''),
      youtubeUrl: String(data.youtubeUrl || ''),
      xUrl: String(data.xUrl || ''),
      spotifyUrl: String(data.spotifyUrl || ''),
      appleMusicUrl: String(data.appleMusicUrl || '')
    });
    setLoading(false);
  }, () => setLoading(false)), []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const user = firebaseAuth.currentUser;
      if (!user) throw new Error('Your admin session has expired. Please sign in again.');
      const token = await user.getIdToken(true);
      const response = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Unable to save social media links.');
      setMessage('Social media links saved and published.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save social media links.');
    } finally {
      setSaving(false);
    }
  }

  return <AdminShell>
    <div className="admin-page-heading">
      <p className="admin-kicker">Aureon Control Center</p>
      <h1>Social Media</h1>
      <p>Add or update Aureon Music Group’s official social profiles. Only channels with a saved URL appear publicly under “Follow Us”.</p>
    </div>
    {message && <div className="admin-cms-message" role="status">{message}</div>}
    <form className="admin-cms-form" style={{ maxWidth: 980 }} onSubmit={save}>
      <fieldset>
        <legend>Official Aureon profiles</legend>
        <p>Paste the full public profile URL, including https://. Leave a field blank to hide that channel from the website.</p>
        <div className="checkout-fields two-columns">
          {fields.map(field => <label key={field.key}>
            {field.label}
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={field.placeholder}
              value={settings[field.key]}
              onChange={event => setSettings(current => ({ ...current, [field.key]: event.target.value.trim() }))}
            />
          </label>)}
        </div>
      </fieldset>
      <button className="admin-primary-action" disabled={loading || saving}>
        {loading ? 'Loading…' : saving ? 'Publishing…' : 'Save social media links'}
      </button>
    </form>
  </AdminShell>;
}
