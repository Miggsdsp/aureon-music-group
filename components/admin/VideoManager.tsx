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
import { firebaseStorage, firestore } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

type Row = { id: string; [key: string]: any };
type Tab = 'videos' | 'albums';

type FormState = {
  title: string;
  slug: string;
  artistId: string;
  videoAlbumId: string;
  type: string;
  duration: string;
  releaseDate: string;
  description: string;
  externalUrl: string;
  thumbnailUrl: string;
  videoUrl: string;
  featured: boolean;
  status: string;
  shortForm: boolean;
};

const emptyForm: FormState = {
  title: '',
  slug: '',
  artistId: '',
  videoAlbumId: '',
  type: 'Music video',
  duration: '',
  releaseDate: '',
  description: '',
  externalUrl: '',
  thumbnailUrl: '',
  videoUrl: '',
  featured: false,
  status: 'draft',
  shortForm: false,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const safe = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]+/g, '-');

const toRow = (item: { id: string; data: () => unknown }): Row => ({
  id: item.id,
  ...((item.data() || {}) as Record<string, any>),
});

export function VideoManager() {
  const [tab, setTab] = useState<Tab>('videos');
  const [artists, setArtists] = useState<Row[]>([]);
  const [albums, setAlbums] = useState<Row[]>([]);
  const [videos, setVideos] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const unsubscribeArtists = onSnapshot(collection(firestore, 'artists'), snapshot => {
      const rows = snapshot.docs
        .map(toRow)
        .filter(item => item.status === 'published' || item.status === 'draft');
      setArtists(rows);
    });

    const unsubscribeAlbums = onSnapshot(collection(firestore, 'videoAlbums'), snapshot => {
      setAlbums(snapshot.docs.map(toRow));
    });

    const unsubscribeVideos = onSnapshot(collection(firestore, 'videos'), snapshot => {
      setVideos(snapshot.docs.map(toRow));
    });

    return () => {
      unsubscribeArtists();
      unsubscribeAlbums();
      unsubscribeVideos();
    };
  }, []);

  const artist = artists.find(item => item.id === form.artistId);

  const availableAlbums = useMemo(
    () =>
      albums.filter(
        item =>
          !form.artistId ||
          item.artistId === form.artistId ||
          item.details?.artistId === form.artistId,
      ),
    [albums, form.artistId],
  );

  const list: Row[] = (tab === 'videos' ? videos : albums).map(item => ({
    ...item,
    __kind: tab,
  }));

  function reset() {
    setEditing(null);
    setProgress(0);
    setForm(emptyForm);
  }

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    reset();
  }

  function edit(item: Row) {
    setEditing(item);
    setTab(item.__kind === 'albums' ? 'albums' : 'videos');
    setForm({
      title: item.title || '',
      slug: item.slug || '',
      artistId: item.artistId || item.details?.artistId || '',
      videoAlbumId: item.videoAlbumId || item.details?.videoAlbumId || '',
      type: item.type || item.genre || item.details?.type || 'Music video',
      duration: item.duration || item.details?.duration || '',
      releaseDate: item.releaseDate || item.details?.releaseDate || '',
      description: item.description || '',
      externalUrl:
        item.externalUrl ||
        item.youtubeUrl ||
        item.vimeoUrl ||
        item.details?.externalUrl ||
        '',
      thumbnailUrl:
        item.thumbnailUrl || item.coverImageUrl || item.details?.thumbnailUrl || '',
      videoUrl: item.videoUrl || item.details?.videoUrl || '',
      featured: Boolean(item.featured),
      status: item.status || 'draft',
      shortForm: Boolean(item.shortForm || item.details?.shortForm),
    });
  }

  async function upload(file: File, key: 'thumbnailUrl' | 'videoUrl') {
    try {
      const folder =
        key === 'thumbnailUrl' ? 'public/videos/thumbnails' : 'public/videos/files';
      const artistFolder = slugify(String(artist?.slug || artist?.name || 'unassigned'));
      const path = `${folder}/${artistFolder}/${Date.now()}-${safe(file.name)}`;
      const task = uploadBytesResumable(ref(firebaseStorage, path), file, {
        contentType: file.type,
      });

      setProgress(1);
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          snapshot =>
            setProgress(
              Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
            ),
          reject,
          resolve,
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);
      setForm(current => ({ ...current, [key]: url }));
      setMessage('Upload complete.');
    } catch (error) {
      console.error('Video upload failed', error);
      setMessage('Upload failed. Please try again.');
    } finally {
      setProgress(0);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');

    if (!form.title || !form.artistId) {
      setMessage('Title and artist are required.');
      return;
    }

    const selectedAlbum = albums.find(item => item.id === form.videoAlbumId);
    const payload: Record<string, any> = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      artistId: artist?.id || '',
      artistName: artist?.name || artist?.title || '',
      artistSlug: artist?.slug || '',
      description: form.description,
      status: form.status,
      featured: form.featured,
      releaseDate: form.releaseDate,
      updatedAt: serverTimestamp(),
    };

    if (tab === 'videos') {
      Object.assign(payload, {
        videoAlbumId: selectedAlbum?.id || '',
        videoAlbumSlug: selectedAlbum?.slug || '',
        videoAlbumTitle: selectedAlbum?.title || '',
        type: form.type,
        duration: form.duration,
        externalUrl: form.externalUrl,
        thumbnailUrl: form.thumbnailUrl,
        videoUrl: form.videoUrl,
        shortForm: form.shortForm,
      });
    } else {
      Object.assign(payload, {
        coverImageUrl: form.thumbnailUrl,
        genre: form.type,
      });
    }

    const collectionName = tab === 'videos' ? 'videos' : 'videoAlbums';

    try {
      if (editing) {
        await updateDoc(doc(firestore, collectionName, editing.id), payload);
      } else {
        await addDoc(collection(firestore, collectionName), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      setMessage('Saved successfully.');
      reset();
    } catch (error) {
      console.error('Unable to save video record', error);
      setMessage('Unable to save. Please try again.');
    }
  }

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Visual catalogue</p>
        <h1>Video Management</h1>
        <p>
          Manage music videos, artist galleries, video albums, YouTube/Vimeo links and
          short-form clips.
        </p>
      </div>

      {message && <div className="admin-cms-message">{message}</div>}

      <div className="admin-toolbar">
        <button type="button" onClick={() => changeTab('videos')}>
          Individual videos
        </button>
        <button type="button" onClick={() => changeTab('albums')}>
          Video albums
        </button>
      </div>

      <section className="admin-cms-grid">
        <form className="admin-cms-form" onSubmit={save}>
          <h2>
            {editing ? 'Edit' : 'Create'} {tab === 'videos' ? 'video' : 'video album'}
          </h2>

          <label>
            Title
            <input
              required
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
            />
          </label>

          <label>
            Artist
            <select
              required
              value={form.artistId}
              onChange={event =>
                setForm({ ...form, artistId: event.target.value, videoAlbumId: '' })
              }
            >
              <option value="">Select artist</option>
              {artists.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name || item.title}
                </option>
              ))}
            </select>
          </label>

          {tab === 'videos' && (
            <label>
              Video album (optional)
              <select
                value={form.videoAlbumId}
                onChange={event =>
                  setForm({ ...form, videoAlbumId: event.target.value })
                }
              >
                <option value="">Artist gallery / no album</option>
                {availableAlbums.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            URL slug
            <input
              value={form.slug}
              onChange={event => setForm({ ...form, slug: event.target.value })}
            />
          </label>

          <div className="checkout-fields two-columns">
            <label>
              {tab === 'videos' ? 'Video category' : 'Genre'}
              <select
                value={form.type}
                onChange={event => setForm({ ...form, type: event.target.value })}
              >
                {[
                  'Music video',
                  'Lyric video',
                  'Visualizer',
                  'Live performance',
                  'Interview',
                  'Behind the song',
                  'Short-form clip',
                ].map(type => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Release date
              <input
                type="date"
                value={form.releaseDate}
                onChange={event =>
                  setForm({ ...form, releaseDate: event.target.value })
                }
              />
            </label>
          </div>

          {tab === 'videos' && (
            <>
              <label>
                Duration
                <input
                  placeholder="3:42"
                  value={form.duration}
                  onChange={event =>
                    setForm({ ...form, duration: event.target.value })
                  }
                />
              </label>

              <label>
                YouTube / Vimeo / external URL
                <input
                  value={form.externalUrl}
                  onChange={event =>
                    setForm({ ...form, externalUrl: event.target.value })
                  }
                />
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={form.shortForm}
                  onChange={event =>
                    setForm({ ...form, shortForm: event.target.checked })
                  }
                />
                Short-form promotional clip
              </label>
            </>
          )}

          <label>
            Description
            <textarea
              value={form.description}
              onChange={event =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>

          <label>
            Thumbnail / cover
            <input
              type="file"
              accept="image/*"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void upload(file, 'thumbnailUrl');
              }}
            />
          </label>

          {tab === 'videos' && (
            <label>
              Upload video file
              <input
                type="file"
                accept="video/*"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file, 'videoUrl');
                }}
              />
            </label>
          )}

          {progress > 0 && <p>Uploading: {progress}%</p>}

          <label>
            Status
            <select
              value={form.status}
              onChange={event => setForm({ ...form, status: event.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={event =>
                setForm({ ...form, featured: event.target.checked })
              }
            />
            Feature on homepage
          </label>

          <button className="primary-button" disabled={progress > 0}>
            {editing ? 'Update' : 'Save'}
          </button>

          {editing && (
            <button type="button" onClick={reset}>
              Cancel
            </button>
          )}
        </form>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Artist</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map(item => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.artistName || '—'}</td>
                    <td>{item.type || item.genre || '—'}</td>
                    <td>{item.status}</td>
                    <td>
                      <button type="button" onClick={() => edit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete permanently?')) {
                            void deleteDoc(
                              doc(
                                firestore,
                                tab === 'videos' ? 'videos' : 'videoAlbums',
                                item.id,
                              ),
                            );
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
