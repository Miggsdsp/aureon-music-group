'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

const documentTypes = [
  ['Terms of Use', 'terms-of-use'],
  ['Privacy Policy', 'privacy-policy'],
  ['Licensing Agreement', 'licensing-agreement'],
  ['Creator License', 'creator-license'],
  ['Listener Subscription Terms', 'listener-subscription-terms'],
  ['Commercial Licensing', 'commercial-licensing'],
  ['Cookie Policy', 'cookie-policy'],
  ['Refund Policy', 'refund-policy'],
  ['Copyright Policy', 'copyright-policy'],
  ['DMCA Policy', 'dmca-policy'],
  ['AI Music Policy', 'ai-music-policy'],
  ['Acceptable Use Policy', 'acceptable-use-policy'],
  ['Artist Submission Agreement', 'artist-submission-agreement'],
  ['Community Guidelines', 'community-guidelines'],
  ['Trademark Policy', 'trademark-policy'],
] as const;

type LegalRow = {
  id: string;
  title?: string;
  slug?: string;
  content?: string;
  version?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  status?: 'draft' | 'published' | 'archived';
  seoTitle?: string;
  seoDescription?: string;
  order?: number;
  versions?: Array<{ version: string; content: string; savedAt: string }>;
};

type LegalForm = {
  title: string;
  slug: string;
  content: string;
  version: string;
  effectiveDate: string;
  status: 'draft' | 'published' | 'archived';
  seoTitle: string;
  seoDescription: string;
  order: number;
};

const blank: LegalForm = {
  title: documentTypes[0][0],
  slug: documentTypes[0][1],
  content: '',
  version: '1.0',
  effectiveDate: '',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  order: 0,
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot extract Word documents. Please use current Safari, Chrome or Edge.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipEntry(buffer: ArrayBuffer, wantedName: string) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= view.byteLength) {
    const signature = readUint32(view, offset);
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }

    const flags = readUint16(view, offset + 6);
    const compression = readUint16(view, offset + 8);
    const compressedSize = readUint32(view, offset + 18);
    const fileNameLength = readUint16(view, offset + 26);
    const extraLength = readUint16(view, offset + 28);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));
    const dataStart = nameStart + fileNameLength + extraLength;

    if ((flags & 0x08) !== 0) throw new Error('This Word document uses an unsupported ZIP layout. Save it again as .docx and retry.');
    if (name === wantedName) {
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      if (compression === 0) return compressed;
      if (compression === 8) return inflateRaw(compressed);
      throw new Error('The Word document uses unsupported compression.');
    }
    offset = dataStart + compressedSize;
  }

  throw new Error('The Word document content could not be found.');
}

function wordXmlToText(xml: string) {
  const documentXml = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentXml.querySelector('parsererror')) throw new Error('The Word document content is invalid.');

  const paragraphs = Array.from(documentXml.getElementsByTagNameNS('*', 'p'));
  const lines = paragraphs.map(paragraph => {
    const textNodes = Array.from(paragraph.getElementsByTagNameNS('*', 't'));
    let text = textNodes.map(node => node.textContent || '').join('');
    if (paragraph.getElementsByTagNameNS('*', 'tab').length) text = text.replace(/\s*$/, '') + '\t';
    return text.trim();
  }).filter(Boolean);

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function readDocx(file: File) {
  const entry = await extractZipEntry(await file.arrayBuffer(), 'word/document.xml');
  return wordXmlToText(new TextDecoder().decode(entry));
}

export function LegalManager() {
  const [items, setItems] = useState<LegalRow[]>([]);
  const [editing, setEditing] = useState<LegalRow | null>(null);
  const [form, setForm] = useState<LegalForm>(blank);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => onSnapshot(collection(firestore, 'legalDocuments'), snapshot => {
    setItems(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() } as LegalRow)));
  }, error => setMessage(`Unable to load legal documents: ${error.message}`)), []);

  const ordered = useMemo(() => [...items].sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999) || String(a.title).localeCompare(String(b.title))), [items]);

  function chooseTemplate(index: number) {
    const [title, slug] = documentTypes[index];
    setEditing(null);
    setForm({ ...blank, title, slug, order: index });
    setMessage('');
  }

  function edit(item: LegalRow) {
    setEditing(item);
    setForm({
      title: item.title || '',
      slug: item.slug || '',
      content: item.content || '',
      version: item.version || '1.0',
      effectiveDate: item.effectiveDate || '',
      status: item.status || 'draft',
      seoTitle: item.seoTitle || '',
      seoDescription: item.seoDescription || '',
      order: Number(item.order ?? 0),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function importFile(file: File) {
    const isDocx = /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = /\.(txt|md|markdown|html|htm)$/i.test(file.name);
    if (!isDocx && !isText) {
      setMessage('Supported files are DOCX, TXT, Markdown and HTML. Legacy .doc and PDF files must be saved as .docx first.');
      return;
    }

    setImporting(true);
    setMessage(`Importing ${file.name}…`);
    try {
      const text = isDocx ? await readDocx(file) : await file.text();
      if (!text.trim()) throw new Error('No readable wording was found in this document.');
      setForm(current => ({ ...current, content: text }));
      setMessage(`${file.name} imported successfully. Review the clause numbering and formatting before publishing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The document could not be imported.');
    } finally {
      setImporting(false);
    }
  }

  async function save(status: LegalForm['status']) {
    if (!form.title.trim() || !form.content.trim()) {
      setMessage('Document title and content are required.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const now = new Date().toISOString();
      const versionEntry = { version: form.version.trim() || '1.0', content: form.content, savedAt: now };
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        content: form.content,
        version: form.version.trim() || '1.0',
        effectiveDate: form.effectiveDate,
        lastUpdated: now.slice(0, 10),
        status,
        seoTitle: form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        order: form.order,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        const versions = [...(editing.versions || []), versionEntry].slice(-25);
        await updateDoc(doc(firestore, 'legalDocuments', editing.id), { ...payload, versions });
      } else {
        await addDoc(collection(firestore, 'legalDocuments'), { ...payload, versions: [versionEntry], createdAt: serverTimestamp() });
      }
      setEditing(null);
      setForm(blank);
      setMessage(status === 'published' ? 'Document published and added to the public Legal Centre/footer.' : status === 'archived' ? 'Document archived and removed from public links.' : 'Draft saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the legal document.');
    } finally {
      setSaving(false);
    }
  }

  return <AdminShell>
    <div className="admin-page-heading">
      <p className="admin-kicker">Governance</p>
      <h1>Legal Centre</h1>
      <p>Import, edit, version and publish every Aureon legal document. Published documents automatically appear on the public website.</p>
    </div>
    {message && <div className="admin-cms-message" role="status">{message}</div>}

    <section className="admin-cms-grid">
      <form className="admin-cms-form" onSubmit={event => { event.preventDefault(); void save('published'); }}>
        <h2>{editing ? 'Edit legal document' : 'Add legal document'}</h2>
        <label>Document template
          <select value={documentTypes.findIndex(([, slug]) => slug === form.slug)} onChange={event => chooseTemplate(Number(event.target.value))}>
            {documentTypes.map(([title], index) => <option value={index} key={title}>{title}</option>)}
          </select>
        </label>
        <div className="checkout-fields two-columns">
          <label>Document title<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required /></label>
          <label>URL slug<input value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} required /></label>
        </div>
        <div className="checkout-fields two-columns">
          <label>Version<input value={form.version} onChange={event => setForm({ ...form, version: event.target.value })} placeholder="1.0" /></label>
          <label>Effective date<input type="date" value={form.effectiveDate} onChange={event => setForm({ ...form, effectiveDate: event.target.value })} /></label>
        </div>
        <label>Import document file
          <input disabled={importing} type="file" accept=".docx,.txt,.md,.markdown,.html,.htm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/html" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ''; }} />
          <small>{importing ? 'Extracting document wording…' : 'Supported: Word DOCX, TXT, Markdown and HTML. Select one document at a time.'}</small>
        </label>
        <label>Document content
          <textarea required style={{ minHeight: 520, fontFamily: 'Georgia, serif', lineHeight: 1.65 }} value={form.content} onChange={event => setForm({ ...form, content: event.target.value })} placeholder="Import or paste the complete approved legal document here..." />
        </label>
        <div className="checkout-fields two-columns">
          <label>SEO title<input value={form.seoTitle} onChange={event => setForm({ ...form, seoTitle: event.target.value })} /></label>
          <label>Display order<input type="number" min="0" value={form.order} onChange={event => setForm({ ...form, order: Number(event.target.value) })} /></label>
        </div>
        <label>SEO description<textarea value={form.seoDescription} onChange={event => setForm({ ...form, seoDescription: event.target.value })} /></label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" disabled={saving || importing} onClick={() => void save('draft')}>Save Draft</button>
          <button className="primary-button" disabled={saving || importing}>{saving ? 'Publishing…' : editing ? 'Update & Publish' : 'Publish Document'}</button>
          {editing && <button type="button" disabled={saving || importing} onClick={() => void save('archived')}>Archive</button>}
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>

      <div className="admin-table-wrap">
        <table>
          <thead><tr><th>Document</th><th>Version</th><th>Effective</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{ordered.length ? ordered.map(item => <tr key={item.id}>
            <td><strong>{item.title}</strong><br /><small>/legal/{item.slug}</small></td>
            <td>{item.version || '1.0'}</td>
            <td>{item.effectiveDate || '—'}</td>
            <td>{item.status || 'draft'}</td>
            <td><button type="button" onClick={() => edit(item)}>Edit</button>{item.status === 'published' && <Link className="admin-table-link" href={`/legal/${item.slug}`} target="_blank">Preview</Link>}</td>
          </tr>) : <tr><td colSpan={5}>No legal documents uploaded yet.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </AdminShell>;
}
