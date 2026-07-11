'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
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
};

type SectionConfig = {
  collectionName: string;
  primaryLabel: string;
  supportsPrice: boolean;
  supportsPublishing: boolean;
};

const configs: Record<string, SectionConfig> = {
  Artists: { collectionName: 'artists', primaryLabel: 'Artist name', supportsPrice: false, supportsPublishing: true },
  Albums: { collectionName: 'albums', primaryLabel: 'Album title', supportsPrice: true, supportsPublishing: true },
  Songs: { collectionName: 'songs', primaryLabel: 'Song title', supportsPrice: true, supportsPublishing: true },
  Videos: { collectionName: 'videos', primaryLabel: 'Video title', supportsPrice: false, supportsPublishing: true },
  News: { collectionName: 'newsArticles', primaryLabel: 'Article title', supportsPrice: false, supportsPublishing: true },
  Merchandise: { collectionName: 'products', primaryLabel: 'Product name', supportsPrice: true, supportsPublishing: true },
  Pages: { collectionName: 'sitePages', primaryLabel: 'Page title', supportsPrice: false, supportsPublishing: true },
  Orders: { collectionName: 'orders', primaryLabel: 'Order reference', supportsPrice: true, supportsPublishing: false },
  Settings: { collectionName: 'siteSettings', primaryLabel: 'Setting name', supportsPrice: false, supportsPublishing: false }
};

const emptyForm = {
  primary: '',
  slug: '',
  description: '',
  status: 'draft',
  price: '0.99',
  featured: false
};

function makeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function AdminSection({ title, description }: { title: string; description: string }) {
  const config = configs[title];
  const [items, setItems] = useState<RecordData[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!config) return;
    const source = query(collection(firestore, config.collectionName), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(source, (snapshot) => {
      setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as RecordData)));
    }, () => {
      const fallback = collection(firestore, config.collectionName);
      return onSnapshot(fallback, (snapshot) => {
        setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as RecordData)));
      });
    });
    return unsubscribe;
  }, [config]);

  const primaryKey = useMemo(() => title === 'Artists' || title === 'Merchandise' ? 'name' : 'title', [title]);

  if (!config) {
    return (
      <AdminShell>
        <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div>
        <section className="admin-empty-state"><h2>{title}</h2><p>This module will be connected in the next operational phase.</p></section>
      </AdminShell>
    );
  }

  function startEdit(item: RecordData) {
    setEditingId(item.id);
    setForm({
      primary: String(item.name || item.title || ''),
      slug: String(item.slug || ''),
      description: String(item.description || ''),
      status: String(item.status || 'draft'),
      price: String(item.price ?? '0.99'),
      featured: Boolean(item.featured)
    });
    setMessage('Editing selected record.');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  }

  async function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!form.primary.trim()) {
      setMessage(`${config.primaryLabel} is required.`);
      return;
    }

    setSaving(true);
    setMessage('');
    const payload = {
      [primaryKey]: form.primary.trim(),
      slug: form.slug.trim() || makeSlug(form.primary),
      description: form.description.trim(),
      status: config.supportsPublishing ? form.status : 'active',
      featured: form.featured,
      ...(config.supportsPrice ? { price: Number(form.price || 0) } : {}),
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        await updateDoc(doc(firestore, config.collectionName, editingId), payload);
        setMessage('Changes saved successfully.');
      } else {
        await addDoc(collection(firestore, config.collectionName), { ...payload, createdAt: serverTimestamp() });
        setMessage('New record created successfully.');
      }
      setEditingId(null);
      setForm(emptyForm);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this record.');
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm('Delete this record permanently?')) return;
    try {
      await deleteDoc(doc(firestore, config.collectionName, id));
      setMessage('Record deleted.');
      if (editingId === id) resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete this record.');
    }
  }

  async function togglePublish(item: RecordData) {
    if (!config.supportsPublishing) return;
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(firestore, config.collectionName, item.id), { status: nextStatus, updatedAt: serverTimestamp() });
      setMessage(nextStatus === 'published' ? 'Content is now visible on the website.' : 'Content is now hidden from the website.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to change visibility.');
    }
  }

  return (
    <AdminShell>
      <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div>
      <div className="admin-cms-toolbar">
        <p>{items.length} record{items.length === 1 ? '' : 's'} in Firebase</p>
        <button type="button" onClick={resetForm}>Create new</button>
      </div>
      {message && <div className="admin-cms-message">{message}</div>}
      <section className="admin-cms-grid">
        <form className="admin-cms-form" onSubmit={saveItem}>
          <h2>{editingId ? `Edit ${title.slice(0, -1)}` : `Create ${title.slice(0, -1)}`}</h2>
          <label>{config.primaryLabel}<input value={form.primary} onChange={(event) => setForm({ ...form, primary: event.target.value })} /></label>
          <label>URL slug<input value={form.slug} placeholder="created-automatically" onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label>
          <label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          {config.supportsPrice && <label>Price (€)<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>}
          {config.supportsPublishing && <label>Visibility<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Draft / hidden</option><option value="published">Published / visible</option></select></label>}
          <label><span>Featured content</span><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /></label>
          <div className="admin-cms-actions"><button className="admin-primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create record'}</button>{editingId && <button type="button" onClick={resetForm}>Cancel</button>}</div>
        </form>

        <div className="admin-cms-list">
          <table>
            <thead><tr><th>Name</th><th>Status</th>{config.supportsPrice && <th>Price</th>}<th>Actions</th></tr></thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={config.supportsPrice ? 4 : 3}>No records yet. Create the first one using the form.</td></tr>}
              {items.map((item) => <tr key={item.id}>
                <td><strong>{item.name || item.title || 'Untitled'}</strong><br /><small>{item.slug || item.id}</small></td>
                <td><span className="admin-status">{item.status || 'active'}</span></td>
                {config.supportsPrice && <td>€{Number(item.price || 0).toFixed(2)}</td>}
                <td><div className="admin-row-actions"><button type="button" onClick={() => startEdit(item)}>Edit</button>{config.supportsPublishing && <button type="button" onClick={() => togglePublish(item)}>{item.status === 'published' ? 'Hide' : 'Publish'}</button>}<button type="button" onClick={() => removeItem(item.id)}>Delete</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
