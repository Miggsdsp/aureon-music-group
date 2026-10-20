import { notFound } from 'next/navigation';
import { getPublicGenre } from '@/lib/public-genres';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { ServerFooter } from '@/components/ServerFooter';
import { NewReleases } from '@/components/discovery/NewReleases';
import styles from '../GenrePages.module.css';

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const genre = await getPublicGenre(slug);
  if (genre === null) notFound();
  return <main className={styles.page}>
    <Header/>
    <section className={styles.hero} aria-labelledby="genre-title">
      <div className={styles.heroInner}>
        <p className={styles.kicker}>Aureon genre collection</p>
        <h1 id="genre-title">{genre || 'All music'} <span>releases.</span></h1>
        <p className={styles.lede}>Explore published Aureon singles, albums, EPs, live releases and remasters. Filter the catalogue by format, artist or year.</p>
        <nav className={styles.heroLinks} aria-label="Catalogue navigation">
          <Link href="/genres">← All genres</Link>
          <Link href="/music">Full catalogue →</Link>
        </nav>
      </div>
    </section>
    <NewReleases genre={genre} showFilters limit={48}/>
    <ServerFooter/>
  </main>;
}
