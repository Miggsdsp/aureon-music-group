'use client';

import { useEffect, useState } from 'react';
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const emptyForm = {
  title: '',
  slug: '',
  category: 'Company news',
  tags: '',
  author: 'Aureon Music Group',
  excerpt: '',
  body: '',
  featuredImageUrl: '',
  publishAt: '',
  featured: false,
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
};

export function NewsManager() {
  const [items, setItems] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState<any>(emptyForm);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firestore, 'newsArticles'),
      snapshot => {
        const nextItems = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .sort((a, b) => {
            const bValue = String(b.publishAt || b.createdAt || '');
            const aValue = String(a.publishAt || a.createdAt || '');
            return bValue.localeCompare(aValue);
          });

        setItems(nextItems);
      },
      error => {
        console.error('Unable to load news articles', error);
        setMessage('Unable to load news articles. Check administrator permissions.');
      },
    );

    return unsubscribe;
  }, []);

  function reset() {
    setEditing(null);
    setProgress(0);
    setForm(emptyForm);
  }

  function edit(item: Row) {
    setEditing(item);
    setForm({
      title: item.title || '',
      slug: item.slug || '',
      category: item.category || 'Company news',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
      author: item.author || 'Aureon Music Group',
      excerpt: item.excerpt || item.description || '',
      body: Array.isArray(item.body)
        ? item.body.join('\n\n')
        : item.body || item.content || '',
      featuredImageUrl: item.featuredImageUrl || item.imageUrl || '',
      publishAt:
        item.publishAt?.toDate?.().toISOString().slice(0, 16) ||
        String(item.publishAt || '').slice(0, 16),
      featured: Boolean(item.featured),
      status: item.status || 'draft',
      seoTitle: item.seoTitle || '',
      seoDescription: item.seoDescription || '',
    });
  }

  async function upload(file: File) {
    setProgress(1);
    setMessage('');

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    const path = `public/news/${Date.now()}-${safeName}`;
    const task = uploadBytesResumable(ref(firebaseStorage, path), file, {
      contentType: file.type,
    });

    try {
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
      setForm((current: any) => ({ ...current, featuredImageUrl: url }));
      setMessage('Featured image uploaded.');
    } catch (error) {
      console.error('News image upload failed', error);
      setMessage('Image upload failed. Please try again.');
    } finally {
      setProgress(0);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');

    if (!form.title || !form.body) {
      setMessage('Title and article body are required.');
      return;
    }

    const publishAt = form.publishAt ? new Date(form.publishAt) : null;
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      category: form.category,
      tags: form.tags
        .split(',')
        .map((tag: string) => tag.trim())
        .filter(Boolean),
      author: form.author,
      excerpt: form.excerpt,
      description: form.excerpt,
      body: form.body,
      content: form.body,
      featuredImageUrl: form.featuredImageUrl,
      imageUrl: form.featuredImageUrl,
      publishAt,
      publishDate: publishAt?.toISOString().slice(0, 10) || '',
      featured: form.featured,
      status: form.status,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editing) {
        await updateDoc(doc(firestore, 'newsArticles', editing.id), payload);
      } else {
        await addDoc(collection(firestore, 'newsArticles'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      reset();
      setMessage('Article saved.');
    } catch (error) {
      console.error('Unable to save news article', error);
      setMessage('Unable to save the article. Please try again.');
    }
  }

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Editorial</p>
        <h1>News CMS</h1>
        <p>
          Create articles, categories, tags, scheduled releases, featured stories and
          search metadata.
        </p>
      </div>

      {message && <div className="admin-cms-message">{message}</div>}

      <section className="admin-cms-grid">
        <form className="admin-cms-form" onSubmit={save}>
          <h2>{editing ? 'Edit' : 'Create'} article</h2>

          <label>
            Headline
            <input
              required
              value={form.title}
              onChange={event => setForm({ ...form, title: event.target.value })}
            />
          </label>

          <label>
            URL slug
            <input
              value={form.slug}
              onChange={event => setForm({ ...form, slug: event.target.value })}
            />
          </label>

          <div className="checkout-fields two-columns">
            <label>
              Category
              <select
                value={form.category}
                onChange={event => setForm({ ...form, category: event.target.value })}
              >
                {[
                  'Company news',
                  'Artist news',
                  'New release',
                  'Behind the music',
                  'Events',
                  'Awards',
                  'Press release',
                ].map(category => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              Author
              <input
                value={form.author}
                onChange={event => setForm({ ...form, author: event.target.value })}
              />
            </label>
          </div>

          <label>
            Tags
            <input
              placeholder="reggae, new release, Nuru"
              value={form.tags}
              onChange={event => setForm({ ...form, tags: event.target.value })}
            />
          </label>

          <label>
            Excerpt
            <textarea
              value={form.excerpt}
              onChange={event => setForm({ ...form, excerpt: event.target.value })}
            />
          </label>

          <label>
            Article body
            <textarea
              style={{ minHeight: 280 }}
              required
              value={form.body}
              onChange={event => setForm({ ...form, body: event.target.value })}
            />
          </label>

          <label>
            Featured image
            <input
              type="file"
              accept="image/*"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
          </label>

          {progress > 0 && <p>Uploading: {progress}%</p>}

          <div className="checkout-fields two-columns">
            <label>
              Publish date and time
              <input
                type="datetime-local"
                value={form.publishAt}
                onChange={event => setForm({ ...form, publishAt: event.target.value })}
              />
            </label>

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
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={event => setForm({ ...form, featured: event.target.checked })}
            />
            Feature on homepage
          </label>

          <label>
            SEO title
            <input
              value={form.seoTitle}
              onChange={event => setForm({ ...form, seoTitle: event.target.value })}
            />
          </label>

          <label>
            SEO description
            <textarea
              value={form.seoDescription}
              onChange={event =>
                setForm({ ...form, seoDescription: event.target.value })
              }
            />
          </label>

          <button className="primary-button" disabled={progress > 0}>
            {editing ? 'Update' : 'Save article'}
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
                <th>Article</th>
                <th>Category</th>
                <th>Publish</th>
                <th>Featured</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map(item => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.category}</td>
                    <td>
                      {item.publishAt?.toDate?.().toLocaleString?.() ||
                        item.publishDate ||
                        'Immediately'}
                    </td>
                    <td>{item.featured ? 'Yes' : 'No'}</td>
                    <td>{item.status}</td>
                    <td>
                      <button type="button" onClick={() => edit(item)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete permanently?')) {
                            void deleteDoc(doc(firestore, 'newsArticles', item.id));
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
                  <td colSpan={6}>No news articles yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
