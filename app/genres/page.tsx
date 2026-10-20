import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { buildGenreCatalogue } from '@/lib/genre-catalogue';
import { breadcrumbSchema, buildMetadata, getPublishedRecords, safeJsonLd, SITE_URL } from '@/lib/seo';
import { GenreDirectory } from './GenreDirectory';
import styles from './GenrePages.module.css';

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: 'Browse Music by Genre | Aureon Music Group',
  description: 'Explore Aureon Music Group’s published original music by genre. Browse real catalogue releases, artists and tracks.',
  path: '/genres',
});

export default async function GenresPage() {
  const [songs, albums, artists] = await Promise.all([
    getPublishedRecords('songs'),
    getPublishedRecords('albums'),
    getPublishedRecords('artists'),
  ]);
  const genres = buildGenreCatalogue(songs, albums, artists);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}/genres#collection`,
    name: 'Browse Aureon music by genre',
    url: `${SITE_URL}/genres`,
    description: 'Browse published Aureon Music Group songs by genre.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: genres.map((genre, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: genre.label,
        url: `${SITE_URL}/genres/${genre.slug}`,
      })),
    },
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Genres', path: '/genres' }]);

  return <main className={styles.page}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />
    <Header />
    <section className={styles.hero} aria-labelledby="genres-title">
      <div className={styles.heroInner}>
        <p className={styles.kicker}>Aureon catalogue</p>
        <h1 id="genres-title">Browse by <span>genre.</span></h1>
        <p className={styles.lede}>Find the sound you’re in the mood for. Each collection below is built from Aureon’s published songs, with track counts drawn directly from the catalogue.</p>
        <nav className={styles.heroLinks} aria-label="Explore the catalogue">
          <Link href="/music">All music <ArrowRight size={14} /></Link>
          <Link href="/artists">Meet the artists <ArrowRight size={14} /></Link>
        </nav>
      </div>
    </section>
    {genres.length ? <GenreDirectory genres={genres} /> : <section className={styles.status}><p>No published songs with a recognised Aureon genre are available yet.</p></section>}
    <Footer />
  </main>;
}
