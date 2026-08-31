'use client';

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { AdminShell } from '@/components/admin/AdminShell';
import { firebaseAuth, firestore, firebaseStorage } from '@/lib/firebase-client';

type Row = { id: string; [key: string]: any };
type AssetKey = 'headerLogoUrl' | 'footerLogoUrl' | 'faviconUrl' | 'heroVideoUrl' | 'heroPosterUrl';
type Settings = {
  merchandiseEnabled: boolean; videosEnabled: boolean; siteName: string; supportEmail: string; announcement: string;
  headerLogoUrl: string; footerLogoUrl: string; faviconUrl: string;
  heroVideoUrl: string; heroPosterUrl: string; heroOverlayOpacity: number;
  heroLightEffects: boolean; heroDustEffects: boolean; heroLedEffects: boolean; heroLogoScale: number;
  featuredArtistId: string; featuredSongId: string; featuredAlbumId: string; featuredVideoId: string;
  featuredNewsId: string; termsPageId: string; privacyPageId: string; licensingPageId: string;
  spotifyUrl: string; youtubeUrl: string; instagramUrl: string; tiktokUrl: string; appleMusicUrl: string;
};

const defaults: Settings = {
  merchandiseEnabled: false, videosEnabled: false, siteName: 'Aureon Music Group', supportEmail: '', announcement: '',
  headerLogoUrl: '', footerLogoUrl: '', faviconUrl: '', heroVideoUrl: '', heroPosterUrl: '',
  heroOverlayOpacity: 58, heroLightEffects: true, heroDustEffects: true, heroLedEffects: true, heroLogoScale: 100,
  featuredArtistId: '', featuredSongId: '', featuredAlbumId: '', featuredVideoId: '', featuredNewsId: '',
  termsPageId: '', privacyPageId: '', licensingPageId: '',
  spotifyUrl: '', youtubeUrl: '', instagramUrl: '', tiktokUrl: '', appleMusicUrl: ''
};

const rows = (snapshot: any): Row[] => snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() }));
const safeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [artists, setArtists] = useState<Row[]>([]); const [songs, setSongs] = useState<Row[]>([]);
  const [albums, setAlbums] = useState<Row[]>([]); const [videos, setVideos] = useState<Row[]>([]);
  const [news, setNews] = useState<Row[]>([]); const [pages, setPages] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, number>>({}); const [message, setMessage] = useState('');
  const [heroVideoName, setHeroVideoName] = useState('');

  useEffect(() => {
    const ignorePermissionError = () => undefined;
    const unsubscribers = [
      onSnapshot(doc(firestore, 'siteSettings', 'platform'), snapshot => {
        setSettings({ ...defaults, ...(snapshot.exists() ? snapshot.data() : {}) } as Settings);
        setLoading(false);
      }, () => setLoading(false)),
      onSnapshot(collection(firestore, 'artists'), snapshot => setArtists(rows(snapshot)), ignorePermissionError),
      onSnapshot(collection(firestore, 'songs'), snapshot => setSongs(rows(snapshot)), ignorePermissionError),
      onSnapshot(collection(firestore, 'albums'), snapshot => setAlbums(rows(snapshot)), ignorePermissionError),
      onSnapshot(collection(firestore, 'videos'), snapshot => setVideos(rows(snapshot)), ignorePermissionError),
      onSnapshot(collection(firestore, 'newsArticles'), snapshot => setNews(rows(snapshot)), ignorePermissionError),
      onSnapshot(collection(firestore, 'sitePages'), snapshot => setPages(rows(snapshot)), ignorePermissionError)
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, []);

  async function publish(nextSettings: Settings) {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Your admin session has expired. Please sign in again.');
    const token = await user.getIdToken(true);
    const response = await fetch('/api/admin/site-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(nextSettings)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result?.error === 'FORBIDDEN' ? 'Your account is not authorised to change site settings.' : result?.error || 'Unable to save settings.');
  }

  async function uploadAsset(file: File, key: AssetKey) {
    if (key === 'heroVideoUrl' && file.type !== 'video/mp4') { setMessage('Please upload an MP4 video.'); return; }
    const folder = key === 'heroVideoUrl' || key === 'heroPosterUrl' ? 'homepage-hero' : 'branding';
    const path = `public/${folder}/${Date.now()}-${safeName(file.name)}`;
    const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type });
    setUploading(current => ({ ...current, [key]: 0 })); setMessage('');
    if (key === 'heroVideoUrl') setHeroVideoName(file.name);
    try {
      await new Promise<void>((resolve, reject) => task.on('state_changed', snapshot => {
        setUploading(current => ({ ...current, [key]: Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) }));
      }, reject, resolve));
      const url = await getDownloadURL(task.snapshot.ref);
      const nextSettings = { ...settings, [key]: url } as Settings;
      setSettings(nextSettings);
      if (key === 'heroVideoUrl') {
        setSaving(true);
        await publish(nextSettings);
        setMessage(`✓ ${file.name} uploaded and published as the homepage video. Refresh the homepage to view it.`);
      } else {
        setMessage(`${key === 'heroPosterUrl' ? 'Homepage poster' : 'Brand asset'} uploaded. Press “Save all settings” to publish it.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload asset.');
    } finally {
      setSaving(false);
      setUploading(current => { const next = { ...current }; delete next[key]; return next; });
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try { await publish(settings); setMessage('Settings saved and published.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save settings.'); }
    finally { setSaving(false); }
  }

  const select = (label: string, key: keyof Settings, items: Row[], empty: string) => <label>{label}<select value={String(settings[key] || '')} onChange={event => setSettings({ ...settings, [key]: event.target.value })}><option value="">{empty}</option>{items.filter(item => item.status === 'published' || !item.status).map(item => <option key={item.id} value={item.id}>{item.name || item.title || item.slug || item.id}</option>)}</select></label>;
  const upload = (label: string, key: AssetKey, accept = 'image/*', help = '') => <label>{label}<input type="file" accept={accept} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, key); }} />{help && <small>{help}</small>}{typeof uploading[key] === 'number' && <progress value={uploading[key]} max={100} style={{ width: '100%' }} />}{settings[key] && <small>✓ Asset connected</small>}</label>;
  const effectToggle = (label: string, key: 'heroLightEffects' | 'heroDustEffects' | 'heroLedEffects') => <div className="admin-feature-toggle"><div><strong>{label}</strong><span>{settings[key] ? 'Enabled on the homepage.' : 'Disabled on the homepage.'}</span></div><label className="admin-switch"><input type="checkbox" checked={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.checked })} /><span className="admin-switch-track"><span className="admin-switch-thumb" /></span><b>{settings[key] ? 'ON' : 'OFF'}</b></label></div>;
  const socialField = (label: string, key: 'spotifyUrl' | 'youtubeUrl' | 'instagramUrl' | 'tiktokUrl' | 'appleMusicUrl', placeholder: string) => <label>{label}<input type="url" inputMode="url" autoComplete="url" value={settings[key]} onChange={event => setSettings({ ...settings, [key]: event.target.value.trim() })} placeholder={placeholder} /><small>Leave blank until the official Aureon profile is ready.</small></label>;

  return <AdminShell><div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>Site Settings & Branding</h1><p>Operate public website features, homepage media, brand assets and legal-page relationships without editing code.</p></div>{message && <div className="admin-cms-message" role="status">{message}</div>}<form className="admin-cms-form" style={{ maxWidth: 1080 }} onSubmit={save}>
    <fieldset><legend>Platform</legend><div className="checkout-fields two-columns"><label>Public site name<input required value={settings.siteName} onChange={event => setSettings({ ...settings, siteName: event.target.value })} /></label><label>Support email<input type="email" value={settings.supportEmail} onChange={event => setSettings({ ...settings, supportEmail: event.target.value })} /></label></div><label>Announcement banner<textarea value={settings.announcement} onChange={event => setSettings({ ...settings, announcement: event.target.value })} placeholder="Leave blank to hide the announcement." /></label><div className="admin-feature-toggle"><div><strong>Merchandise page</strong><span>{settings.merchandiseEnabled ? 'Visible in the public navigation and available to customers.' : 'Hidden from the public navigation and unavailable to customers.'}</span></div><label className="admin-switch"><input type="checkbox" checked={settings.merchandiseEnabled} onChange={event => setSettings({ ...settings, merchandiseEnabled: event.target.checked })} /><span className="admin-switch-track"><span className="admin-switch-thumb" /></span><b>{settings.merchandiseEnabled ? 'ON' : 'OFF'}</b></label></div><div className="admin-feature-toggle"><div><strong>Videos page</strong><span>{settings.videosEnabled ? 'Visible in the public navigation and available to visitors.' : 'Hidden from the public navigation and unavailable to visitors.'}</span></div><label className="admin-switch"><input type="checkbox" checked={settings.videosEnabled} onChange={event => setSettings({ ...settings, videosEnabled: event.target.checked })} /><span className="admin-switch-track"><span className="admin-switch-thumb" /></span><b>{settings.videosEnabled ? 'ON' : 'OFF'}</b></label></div></fieldset>

    <fieldset><legend>Homepage Hero Manager</legend><p>The selected MP4 is now published automatically as soon as its upload finishes.</p><div className="checkout-fields two-columns">{upload('Background video', 'heroVideoUrl', 'video/mp4', 'Choose the exact MP4. Do not press Save afterwards—the video auto-publishes.')}{upload('Poster / fallback image', 'heroPosterUrl', 'image/jpeg,image/png,image/webp', 'Shown while the video loads.')}</div>{heroVideoName && <p><strong>Selected video:</strong> {heroVideoName}</p>}<div className="checkout-fields two-columns"><label>Overlay darkness: {settings.heroOverlayOpacity}%<input type="range" min="0" max="100" value={settings.heroOverlayOpacity} onChange={event => setSettings({ ...settings, heroOverlayOpacity: Number(event.target.value) })} /></label><label>Homepage logo size: {settings.heroLogoScale}%<input type="range" min="60" max="150" value={settings.heroLogoScale} onChange={event => setSettings({ ...settings, heroLogoScale: Number(event.target.value) })} /></label></div>{effectToggle('Animated light effects', 'heroLightEffects')}{effectToggle('Floating dust effects', 'heroDustEffects')}{effectToggle('Studio LED effects', 'heroLedEffects')}
      {settings.heroVideoUrl && <div style={{ position: 'relative', marginTop: 18, overflow: 'hidden', borderRadius: 12, minHeight: 360, background: '#000' }}><video key={settings.heroVideoUrl} src={settings.heroVideoUrl} poster={settings.heroPosterUrl || undefined} muted loop autoPlay playsInline controls style={{ width: '100%', height: 420, objectFit: 'cover', display: 'block' }} /><div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${settings.heroOverlayOpacity / 100})`, pointerEvents: 'none' }} /><div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}><img src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group overlay preview" style={{ width: `${Math.min(settings.heroLogoScale, 130) * 3.8}px`, maxWidth: '72vw', height: 'auto' }} /><p style={{ letterSpacing: '.45em', fontWeight: 700, marginTop: 10 }}>CREATING TOMORROW’S CLASSICS</p></div></div>}
    </fieldset>

    <fieldset><legend>Logos and branding assets</legend><div className="checkout-fields two-columns">{upload('Header logo', 'headerLogoUrl')}{upload('Footer logo', 'footerLogoUrl')}</div>{upload('Favicon / app icon', 'faviconUrl', 'image/png,image/x-icon,image/svg+xml')}</fieldset>
    <fieldset><legend>Social media profiles</legend><p>Add only Aureon Music Group’s official profile URLs. These values are saved through the authenticated admin API and appear automatically under “Follow Us” in the public footer.</p><div className="checkout-fields two-columns">{socialField('Spotify', 'spotifyUrl', 'https://open.spotify.com/...')}{socialField('YouTube', 'youtubeUrl', 'https://www.youtube.com/@...')}{socialField('Instagram', 'instagramUrl', 'https://www.instagram.com/...')}{socialField('TikTok', 'tiktokUrl', 'https://www.tiktok.com/@...')}{socialField('Apple Music', 'appleMusicUrl', 'https://music.apple.com/...')}</div></fieldset>
    <fieldset><legend>Homepage featured content</legend><div className="checkout-fields two-columns">{select('Featured artist', 'featuredArtistId', artists, 'Automatic / none selected')}{select('Featured song', 'featuredSongId', songs, 'Automatic / none selected')}{select('Featured album', 'featuredAlbumId', albums, 'Automatic / none selected')}{select('Featured video', 'featuredVideoId', videos, 'Automatic / none selected')}</div>{select('Featured news article', 'featuredNewsId', news, 'Automatic / none selected')}</fieldset>
    <fieldset><legend>Legal-page relationships</legend><p>Choose the published Control Center pages used for the public legal links.</p><div className="checkout-fields two-columns">{select('Terms of use', 'termsPageId', pages, 'Use page with slug terms')}{select('Privacy policy', 'privacyPageId', pages, 'Use page with slug privacy')}{select('Licensing terms', 'licensingPageId', pages, 'Use page with slug licensing')}</div></fieldset>
    <button className="admin-primary-action" disabled={loading || saving || Object.keys(uploading).length > 0}>{loading ? 'Loading…' : saving ? 'Publishing…' : 'Save all settings'}</button>
  </form></AdminShell>;
}
