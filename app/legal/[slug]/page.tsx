'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import styles from './LegalDocument.module.css';

type LegalDocument = {
  title?: string;
  slug?: string;
  content?: string;
  version?: string;
  effectiveDate?: string;
  lastUpdated?: string;
};

function renderLine(line: string, index: number) {
  const value = line.trim();
  if (!value) return <div className={styles.spacer} key={index} />;
  if (/^#{1,3}\s+/.test(value)) {
    const clean = value.replace(/^#{1,3}\s+/, '');
    return <h2 key={index}>{clean}</h2>;
  }
  if (/^\d+[.)]\s+/.test(value)) return <p className={styles.clause} key={index}>{value}</p>;
  if (/^[-*•]\s+/.test(value)) return <li key={index}>{value.replace(/^[-*•]\s+/, '')}</li>;
  if (/^[A-Z][A-Z\s&/()-]{4,}$/.test(value)) return <h2 key={index}>{value}</h2>;
  return <p key={index}>{value}</p>;
}

export default function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/legal?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error('NOT_FOUND');
        if (active) setData(payload.document || null);
      })
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main><Header /><section className={styles.shell}><p>Loading legal document…</p></section><Footer /></main>;
  if (!data) return <main><Header /><section className={styles.shell}><p className={styles.kicker}>Legal Centre</p><h1>Document not found</h1><p>This document is not published or has been archived.</p><Link className="ghost-button" href="/legal">View all legal documents →</Link></section><Footer /></main>;

  const lines = String(data.content || '').split(/\r?\n/);
  return <main>
    <Header />
    <article className={styles.shell}>
      <header className={styles.heading}>
        <p className={styles.kicker}>Aureon Music Group Legal Centre</p>
        <h1>{data.title}</h1>
        <div className={styles.meta}>
          <span>Version {data.version || '1.0'}</span>
          {data.effectiveDate && <span>Effective {new Date(`${data.effectiveDate}T00:00:00`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
          {data.lastUpdated && <span>Last updated {new Date(`${data.lastUpdated}T00:00:00`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        </div>
        <Link className="ghost-button" href="/legal">← Back to Legal Centre</Link>
      </header>
      <section className={styles.content}>{lines.map(renderLine)}</section>
    </article>
    <Footer />
  </main>;
}
