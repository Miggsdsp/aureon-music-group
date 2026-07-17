'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firestore, firebaseStorage } from '@/lib/firebase-client';
import { artists as builtInArtists } from '@/data/artists';
import { AdminShell } from './AdminShell';

type RecordData = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  description?: string;
  status?: string;
  price?: number;
  featured?: boolean;
  details?: Record<string, any>;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  albumSlug?: string;
  genre?: string;
  trackNumber?: number;
  isrc?: string;
  releaseDate?: string;
  purchasable?: boolean;
  promotional?: boolean;
  [key: string]: any;
};

type SectionConfig = {
  collectionName: string;
  primaryLabel: string;
  supportsPrice: boolean;
  supportsPublishing: boolean;
};

type UploadField = {
  key: string;
  label: string;
  accept: string;
  folder: string;
  privatePath?: boolean;
  multiple?: boolean;
  autoPreview?: boolean;
};

type RelationForm = {
  artistId: string;
  albumId: string;
  genre: string;
  trackNumber: string;
  isrc: string;
  releaseDate: string;
  purchasable: boolean;
  promotional: boolean;
};

const configs: Record<string, SectionConfig> = {
  Artists: { collectionName: 'artists', primaryLabel: 'Artist name', supportsPrice: false, supportsPublishing: true },
  Albums: { collectionName: 'albums', primaryLabel: 'Album title', supportsPrice: false, supportsPublishing: true },
  Songs: { collectionName: 'songs', primaryLabel: 'Song title', supportsPrice: true, supportsPublishing: true },
  Videos: { collectionName: 'videoAlbums', primaryLabel: 'Video album title', supportsPrice: false, supportsPublishing: true },
  News: { collectionName: 'newsArticles', primaryLabel: 'Article title', supportsPrice: false, supportsPublishing: true },
  Merchandise: { collectionName: 'products', primaryLabel: 'Product name', supportsPrice: true, supportsPublishing: true },
  Pages: { collectionName: 'sitePages', primaryLabel: 'Page title', supportsPrice: false, supportsPublishing: true },
  Orders: { collectionName: 'orders', primaryLabel: 'Order reference', supportsPrice: true, supportsPublishing: false },
  Settings: { collectionName: 'siteSettings', primaryLabel: 'Setting name', supportsPrice: false, supportsPublishing: false },
};

const uploadFields: Record<string, UploadField[]> = {
  Artists: [
    { key: 'logoUrl', label: 'Artist logo', accept: 'image/*', folder: 'public/artists/logos' },
    { key: 'profileImageUrl', label: 'Profile image', accept: 'image/*', folder: 'public/artists/profiles' },
    { key: 'bannerImageUrl', label: 'Banner image', accept: 'image/*', folder: 'public/artists/banners' },
  ],
  Albums: [{ key: 'coverImageUrl', label: 'Album cover artwork', accept: 'image/*', folder: 'public/albums/covers' }],
  Songs: [
    { key: 'coverImageUrl', label: 'Song cover artwork', accept: 'image/*', folder: 'public/songs/covers' },
    {
      key: 'privateFilePath',
      label: 'Full song MP3/WAV — Aureon creates the 40-second preview automatically',
      accept: 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav',
      folder: 'private/full-tracks',
      privatePath: true,
      autoPreview: true,
    },
  ],
  Videos: [
    { key: 'thumbnailUrl', label: 'Video thumbnail', accept: 'image/*', folder: 'public/videos/thumbnails' },
    { key: 'videoUrl', label: 'Video file', accept: 'video/*', folder: 'public/videos/files' },
  ],
  News: [{ key: 'featuredImageUrl', label: 'Featured image', accept: 'image/*', folder: 'public/news' }],
  Merchandise: [
    { key: 'imageUrl', label: 'Main product image', accept: 'image/*', folder: 'public/products' },
    { key: 'galleryUrls', label: 'Additional product images', accept: 'image/*', folder: 'public/products/gallery', multiple: true },
  ],
};

const emptyForm = {
  primary: '',
  slug: '',
  description: '',
  status: 'draft',
  price: '0.99',
  featured: false,
  details: '{}',
};

const emptyRelations: RelationForm = {
  artistId: '',
  albumId: '',
  genre: '',
  trackNumber: '',
  isrc: '',
  releaseDate: '',
  purchasable: true,
  promotional: false,
};

const fallbackArtists: RecordData[] = builtInArtists.map(artist => ({
  id: artist.id,
  name: artist.name,
  slug: artist.slug,
  genre: artist.genre,
  status: 'published',
  description: artist.desc,
}));

function makeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function createWavBlob(buffer: AudioBuffer, seconds = 40) {
  const frames = Math.min(buffer.length, Math.floor(buffer.sampleRate * seconds));
  const channels = Math.min(buffer.numberOfChannels, 2);
  const dataSize = frames * channels * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function buildPreviewFile(file: File, slug: string) {
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot create audio previews.');
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    return new File([createWavBlob(buffer, 40)], `${slug}-preview.wav`, { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

export function AdminSection({ title, description }: { title: string; description: string }) {
  const config = configs[title];
  const [items, setItems] = useState<RecordData[]>([]);
  const [firestoreArtists, setFirestoreArtists] = useState<RecordData[]>([]);
  const [albums, setAlbums] = useState<RecordData[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [relations, setRelations] = useState<RelationForm>(emptyRelations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const [uploadedDetails, setUploadedDetails] = useState<Record<string, any>>({});

  const artists = useMemo(() => {
    const map = new Map<string, RecordData>();
    fallbackArtists.forEach(artist => map.set(String(artist.slug || artist.id), artist));
    firestoreArtists.forEach(artist => map.set(String(artist.slug || artist.id), artist));
    return [...map.values()].sort((a, b) => String(a.name || a.title).localeCompare(String(b.name || b.title)));
  }, [firestoreArtists]);

  useEffect(() => {
    if (!config) return;
    return onSnapshot(
      collection(firestore, config.collectionName),
      snapshot => setItems(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as RecordData))),
      error => setMessage(`Unable to load ${title.toLowerCase()}: ${error.message}`),
    );
  }, [config, title]);

  useEffect(() => {
    if (title !== 'Songs' && title !== 'Albums') return;
    return onSnapshot(
      collection(firestore, 'artists'),
      snapshot => setFirestoreArtists(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as RecordData))),
      () => setFirestoreArtists([]),
    );
  }, [title]);

  useEffect(() => {
    if (title !== 'Songs') return;
    return onSnapshot(
      collection(firestore, 'albums'),
      snapshot => setAlbums(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as RecordData))),
      () => setAlbums([]),
    );
  }, [title]);

  const primaryKey = title === 'Artists' || title === 'Merchandise' ? 'name' : 'title';
  const fields = uploadFields[title] || [];
  const selectedArtist = artists.find(artist => artist.id === relations.artistId);
  const availableAlbums = albums.filter(
    album => !relations.artistId || album.artistId === relations.artistId || album.details?.artistId === relations.artistId,
  );

  if (!config) {
    return <AdminShell><section className="admin-empty-state"><h2>{title}</h2><p>Module unavailable.</p></section></AdminShell>;
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setRelations(emptyRelations);
    setUploadedDetails({});
    setUploading({});
    setMessage('');
  }

  function startEdit(item: RecordData) {
    const details = item.details || {};
    setEditingId(item.id);
    setUploadedDetails(details);
    setForm({
      primary: String(item.name || item.title || ''),
      slug: String(item.slug || ''),
      description: String(item.description || ''),
      status: String(item.status || 'draft'),
      price: String(item.price ?? '0.99'),
      featured: Boolean(item.featured),
      details: JSON.stringify(details, null, 2),
    });
    setRelations({
      artistId: String(item.artistId || details.artistId || ''),
      albumId: String(item.albumId || details.albumId || ''),
      genre: String(item.genre || details.genre || ''),
      trackNumber: String(item.trackNumber || details.trackNumber || ''),
      isrc: String(item.isrc || details.isrc || ''),
      releaseDate: String(item.releaseDate || details.releaseDate || ''),
      purchasable: item.purchasable !== false && details.purchasable !== false,
      promotional: Boolean(item.promotional || details.promotional),
    });
  }

  function uploadToStorage(path: string, file: File, key: string, returnPath = false) {
    setUploading(current => ({ ...current, [key]: 0 }));
    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type || undefined });
      task.on(
        'state_changed',
        snapshot => setUploading(current => ({ ...current, [key]: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) })),
        reject,
        async () => {
          const value = returnPath ? path : await getDownloadURL(task.snapshot.ref);
          setUploading(current => {
            const next = { ...current };
            delete next[key];
            return next;
          });
          resolve(value);
        },
      );
    });
  }

  async function uploadFile(field: UploadField, file: File) {
    if (title === 'Songs' && !relations.artistId) {
      setMessage('Select an artist before uploading.');
      return;
    }
    const slug = form.slug.trim() || makeSlug(form.primary || 'upload');
    const artistFolder = title === 'Songs'
      ? String(selectedArtist?.slug || makeSlug(String(selectedArtist?.name || 'unassigned')))
      : '';
    const folder = artistFolder ? `${field.folder}/${artistFolder}` : field.folder;
    const objectName = `${slug}-${Date.now()}-${safeFileName(file.name)}`;

    try {
      const value = await uploadToStorage(`${folder}/${objectName}`, file, field.key, Boolean(field.privatePath));
      setUploadedDetails(current => field.multiple
        ? { ...current, [field.key]: [...(Array.isArray(current[field.key]) ? current[field.key] : []), value] }
        : { ...current, [field.key]: value });

      if (field.autoPreview) {
        setMessage('Creating 40-second preview…');
        const preview = await buildPreviewFile(file, slug);
        const previewUrl = await uploadToStorage(
          `public/previews/${artistFolder}/${slug}-${Date.now()}-preview.wav`,
          preview,
          'previewUrl',
        );
        setUploadedDetails(current => ({ ...current, previewUrl, previewDuration: 40 }));
        setMessage('Song and preview uploaded successfully.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    }
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!form.primary.trim()) return setMessage(`${config.primaryLabel} is required.`);
    if ((title === 'Songs' || title === 'Albums') && !relations.artistId) return setMessage('Please select an artist.');
    if (title === 'Songs' && !uploadedDetails.privateFilePath && !editingId) return setMessage('Please upload the full song.');

    setSaving(true);
    try {
      const manual = JSON.parse(form.details || '{}');
      const artist = artists.find(item => item.id === relations.artistId);
      const album = albums.find(item => item.id === relations.albumId);
      const relationData = (title === 'Songs' || title === 'Albums')
        ? {
            artistId: artist?.id || '',
            artistName: String(artist?.name || artist?.title || ''),
            artistSlug: String(artist?.slug || ''),
            genre: relations.genre,
            releaseDate: relations.releaseDate,
            ...(title === 'Songs' ? {
              albumId: album?.id || '',
              albumTitle: String(album?.title || ''),
              albumSlug: String(album?.slug || ''),
              trackNumber: Number(relations.trackNumber || 0),
              isrc: relations.isrc,
              purchasable: relations.purchasable,
              promotional: relations.promotional,
            } : {}),
          }
        : {};
      const details = { ...manual, ...uploadedDetails, ...relationData };
      const payload: Record<string, any> = {
        [primaryKey]: form.primary.trim(),
        slug: form.slug.trim() || makeSlug(form.primary),
        description: form.description.trim(),
        status: config.supportsPublishing ? form.status : 'active',
        featured: form.featured,
        details,
        ...uploadedDetails,
        ...relationData,
        updatedAt: serverTimestamp(),
        ...(config.supportsPrice ? { price: Number(form.price || 0) } : {}),
      };

      if (editingId) await updateDoc(doc(firestore, config.collectionName, editingId), payload);
      else await addDoc(collection(firestore, config.collectionName), { ...payload, createdAt: serverTimestamp() });
      setMessage('Saved successfully.');
      resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (confirm('Delete this record permanently?')) await deleteDoc(doc(firestore, config.collectionName, id));
  }

  async function togglePublish(item: RecordData) {
    await updateDoc(doc(firestore, config.collectionName, item.id), {
      status: item.status === 'published' ? 'draft' : 'published',
      updatedAt: serverTimestamp(),
    });
  }

  const toggleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 0',
    margin: 0,
  };

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Aureon Control Center</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {message && <div className="admin-cms-message">{message}</div>}

      <section className="admin-cms-grid">
        <form className="admin-cms-form" onSubmit={saveItem}>
          <h2>{editingId ? 'Edit' : 'Create'} {title.slice(0, -1)}</h2>

          <label>{config.primaryLabel}<input value={form.primary} onChange={event => setForm({ ...form, primary: event.target.value })} /></label>

          {(title === 'Songs' || title === 'Albums') && (
            <label>Artist<select required value={relations.artistId} onChange={event => setRelations({ ...relations, artistId: event.target.value, albumId: '' })}>
              <option value="">Select artist</option>
              {artists.map(artist => <option key={artist.id} value={artist.id}>{String(artist.name || artist.title)}</option>)}
            </select></label>
          )}

          {title === 'Songs' && (
            <label>Album (optional)<select disabled={!relations.artistId} value={relations.albumId} onChange={event => setRelations({ ...relations, albumId: event.target.value })}>
              <option value="">{!relations.artistId ? 'Select an artist first' : availableAlbums.length ? 'Single / no album' : 'No albums yet — save as single'}</option>
              {availableAlbums.map(album => <option key={album.id} value={album.id}>{String(album.title || 'Untitled album')}</option>)}
            </select></label>
          )}

          {(title === 'Songs' || title === 'Albums') && (
            <div className="checkout-fields two-columns">
              <label>Genre<input value={relations.genre} onChange={event => setRelations({ ...relations, genre: event.target.value })} /></label>
              <label>Release date<input type="date" value={relations.releaseDate} onChange={event => setRelations({ ...relations, releaseDate: event.target.value })} /></label>
            </div>
          )}

          {title === 'Songs' && (
            <>
              <div className="checkout-fields two-columns">
                <label>Track number<input type="number" min="0" value={relations.trackNumber} onChange={event => setRelations({ ...relations, trackNumber: event.target.value })} /></label>
                <label>ISRC (optional)<input value={relations.isrc} onChange={event => setRelations({ ...relations, isrc: event.target.value.toUpperCase() })} /></label>
              </div>
              <label style={toggleStyle}><input style={{ width: 18, height: 18, margin: 0, flex: '0 0 auto' }} type="checkbox" checked={relations.purchasable} onChange={event => setRelations({ ...relations, purchasable: event.target.checked })} /><span>Available to purchase</span></label>
              <label style={toggleStyle}><input style={{ width: 18, height: 18, margin: 0, flex: '0 0 auto' }} type="checkbox" checked={relations.promotional} onChange={event => setRelations({ ...relations, promotional: event.target.checked })} /><span>Promotional / free song</span></label>
            </>
          )}

          <label>URL slug<input value={form.slug} placeholder="created-automatically" onChange={event => setForm({ ...form, slug: event.target.value })} /></label>
          <label>Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>

          {config.supportsPrice && <label>Price (€)<input type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>}

          {fields.length > 0 && (
            <fieldset>
              <legend>Files and media</legend>
              {fields.map(field => (
                <div key={field.key} style={{ marginBottom: 18 }}>
                  <label>{field.label}<input type="file" accept={field.accept} multiple={field.multiple} onChange={async event => {
                    const files = Array.from(event.target.files || []);
                    for (const file of files) await uploadFile(field, file);
                  }} /></label>
                  {typeof uploading[field.key] === 'number' && <progress value={uploading[field.key]} max={100} style={{ width: '100%' }} />}
                  {Boolean(uploadedDetails[field.key]) && <small>✓ Uploaded</small>}
                </div>
              ))}
            </fieldset>
          )}

          <details>
            <summary>Advanced content fields (optional)</summary>
            <textarea rows={8} value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} />
          </details>

          {config.supportsPublishing && (
            <>
              <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select></label>
              <label style={toggleStyle}><input style={{ width: 18, height: 18, margin: 0, flex: '0 0 auto' }} type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })} /><span>Feature on homepage</span></label>
            </>
          )}

          <button className="primary-button" disabled={saving || Object.keys(uploading).length > 0}>{saving ? 'Saving…' : editingId ? 'Update' : 'Save'}</button>
          {editingId && <button type="button" onClick={resetForm}>Cancel</button>}
        </form>

        <div className="admin-table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Status</th>{config.supportsPrice && <th>Price</th>}<th>Actions</th></tr></thead>
            <tbody>
              {items.length ? items.map(item => (
                <tr key={item.id}>
                  <td>{String(item.name || item.title || 'Untitled')}</td>
                  <td>{String(item.status || '—')}</td>
                  {config.supportsPrice && <td>€{Number(item.price || 0).toFixed(2)}</td>}
                  <td>
                    <button type="button" onClick={() => startEdit(item)}>Edit</button>
                    {config.supportsPublishing && <button type="button" onClick={() => togglePublish(item)}>{item.status === 'published' ? 'Unpublish' : 'Publish'}</button>}
                    <button type="button" onClick={() => removeItem(item.id)}>Delete</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={config.supportsPrice ? 4 : 3}>No records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
