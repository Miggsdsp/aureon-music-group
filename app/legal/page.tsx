'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import styles from './[slug]/LegalDocument.module.css';

type LegalDocument = {
  id: string;
  title?: string;
  slug?: string;
  version?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  seoDescription?: string;
};

export default function LegalCentrePage() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/legal', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load legal documents.');
        if (active) setDocuments(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch(error => active && setError(error instanceof Error ? error.message : 'Unable to load legal documents.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return <main>
    <Header />
    <section className={styles.shell}>
      <header className={styles.heading}>
        <p className={styles.kicker}>Aureon Music Group</p>
        <h1>Legal Centre</h1>
        <p>Public policies, subscription terms, licensing conditions and platform rules. These documents are available to every visitor, whether subscribed or not.</p>
      </header>
      {loading && <p>Loading legal documents…</p>}
      {error && <p>{error}</p>}
      {!loading && !error && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        {documents.map(document => <article key={document.id} style={{ border: '1px solid rgba(216,184,95,.38)', padding: 24, background: '#090909' }}>
          <p className={styles.kicker}>Version {document.version || '1.0'}</p>
          <h2 style={{ marginTop: 8 }}>{document.title || 'Legal document'}</h2>
          {document.seoDescription && <p>{document.seoDescription}</p>}
          <p style={{ opacity: .75 }}>{document.effectiveDate ? `Effective ${new Date(`${document.effectiveDate}T00:00:00`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}` : document.lastUpdated ? `Updated ${document.lastUpdated}` : ''}</p>
          <Link className="ghost-button" href={`/legal/${document.slug || document.id}`}>Read document →</Link>
        </article>)}
      </div>}
      {!loading && !error && documents.length === 0 && <p>No published legal documents are currently available.</p>}
    </section>
    <Footer />
  </main>;
}
