import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { adminFirestore } from '@/lib/firebase-admin';
import { buildMetadata } from '@/lib/seo';
import styles from './LegalDocument.module.css';

type LegalDocument = {
  id: string;
  title?: string;
  slug?: string;
  content?: string;
  version?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  seoDescription?: string;
};

export const revalidate = 300;

async function getLegalDocument(slug: string): Promise<LegalDocument | null> {
  if (!slug || slug.includes('/')) return null;
  const snapshot = await adminFirestore.collection('legalDocuments').where('slug', '==', slug).where('status', '==', 'published').limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as LegalDocument;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const document = await getLegalDocument(slug);
  if (!document) notFound();
  return buildMetadata({
    title: document.title || 'Legal Document',
    description: document.seoDescription || `Read ${document.title || 'this Aureon Music Group legal document'}.`,
    path: `/legal/${document.slug || slug}`,
  });
}

function renderLine(line: string, index: number) {
  const value = line.trim();
  if (!value) return <div className={styles.spacer} key={index} />;
  if (/^#{1,3}\s+/.test(value)) return <h2 key={index}>{value.replace(/^#{1,3}\s+/, '')}</h2>;
  if (/^\d+[.)]\s+/.test(value)) return <p className={styles.clause} key={index}>{value}</p>;
  if (/^[-*•]\s+/.test(value)) return <li key={index}>{value.replace(/^[-*•]\s+/, '')}</li>;
  if (/^[A-Z][A-Z\s&/()-]{4,}$/.test(value)) return <h2 key={index}>{value}</h2>;
  return <p key={index}>{value}</p>;
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getLegalDocument(slug);
  if (!data) notFound();

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
