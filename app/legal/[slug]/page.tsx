'use client';

import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
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
  const { data, loading } = usePublishedDocument<LegalDocument>('legalDocuments', slug, null);

  if (loading) return <main><Header /><section className={styles.shell}><p>Loading legal document…</p></section><Footer /></main>;
  if (!data) return <main><Header /><section className={styles.shell}><p className={styles.kicker}>Legal Centre</p><h1>Document not found</h1><p>This document is not published or has been archived.</p></section><Footer /></main>;

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
      </header>
      <section className={styles.content}>{lines.map(renderLine)}</section>
    </article>
    <Footer />
  </main>;
}
