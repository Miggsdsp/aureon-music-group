import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { adminFirestore } from '@/lib/firebase-admin';
import { buildMetadata } from '@/lib/seo';
import styles from './[slug]/LegalDocument.module.css';

type LegalDocument = {
  id: string;
  title?: string;
  slug?: string;
  version?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  seoDescription?: string;
  order?: number;
};

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Legal Centre | Aureon Music Group',
  description: 'Public Aureon Music Group legal documents, policies, subscription terms, licensing conditions and platform rules.',
  path: '/legal',
});

async function getLegalDocuments(): Promise<LegalDocument[]> {
  const snapshot = await adminFirestore.collection('legalDocuments').where('status', '==', 'published').get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as LegalDocument))
    .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999) || String(a.title || '').localeCompare(String(b.title || '')));
}

function dateLabel(document: LegalDocument) {
  if (document.effectiveDate) {
    return `Effective ${new Date(`${document.effectiveDate}T00:00:00`).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  if (document.lastUpdated) return `Updated ${document.lastUpdated}`;
  return '';
}

export default async function LegalCentrePage() {
  const documents = await getLegalDocuments();

  return <main>
    <Header />
    <section className={styles.shell}>
      <header className={styles.heading}>
        <p className={styles.kicker}>Aureon Music Group</p>
        <h1>Legal Centre</h1>
        <p>Public policies, subscription terms, licensing conditions and platform rules. These documents are available to every visitor, whether subscribed or not.</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
        {documents.map(document => <article key={document.id} style={{ border: '1px solid rgba(216,184,95,.38)', padding: 24, background: '#090909' }}>
          <p className={styles.kicker}>Version {document.version || '1.0'}</p>
          <h2 style={{ marginTop: 8 }}>{document.title || 'Legal document'}</h2>
          {document.seoDescription && <p>{document.seoDescription}</p>}
          {dateLabel(document) && <p style={{ opacity: .75 }}>{dateLabel(document)}</p>}
          <Link className="ghost-button" href={`/legal/${document.slug || document.id}`}>Read document →</Link>
        </article>)}
      </div>
      {documents.length === 0 && <p>No published legal documents are currently available.</p>}
    </section>
    <Footer />
  </main>;
}
