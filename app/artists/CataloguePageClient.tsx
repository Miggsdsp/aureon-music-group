'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Sparkles } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { getArtwork } from '@/lib/get-artwork';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './ArtistsPage.module.css';

type ArtistRecord = PublicRecord & {
  name: string;
  slug: string;
  genre?: string;
  genres?: string[];
  description?: string;
  bio?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  image?: string;
};

const text = (value: unknown) => String(value || '').trim();

export default function ArtistsPage() {
  const { items: artists, loading } = usePublishedCollection<ArtistRecord>('artists', [], true);
  const [search, setSearch] = useState('');
  const visibleArtists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return artists;
    return artists.filter(artist => [artist.name, artist.genre, ...(artist.genres || [])].some(value => text(value).toLocaleLowerCase().includes(query)));
  }, [artists, search]);

  return (
    <main className={styles.page}>
      <Header />
      <section className={styles.hero} aria-labelledby="artists-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <p className={styles.kicker}><Sparkles size={14} /> Artists of Aureon</p>
        <h1 id="artists-title">Meet the artists<br /><span>behind the sound.</span></h1>
        <p className={styles.lede}>Distinct voices, original music and worlds worth discovering. Find an artist, explore their releases and start listening.</p>
        <div className={styles.heroActions}>
          <Link href="/music" className={styles.primaryAction}>Explore the music <ArrowUpRight size={16} /></Link>
          <Link href="/genres" className={styles.secondaryAction}>Browse by genre</Link>
        </div>
      </section>

      <section className={styles.catalogue} aria-labelledby="artist-catalogue-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>The Aureon roster</p>
            <h2 id="artist-catalogue-title">Find your next favourite</h2>
          </div>
          <label className={styles.search}>
            <Search size={17} aria-hidden="true" />
            <span className={styles.srOnly}>Search artists or genres</span>
            <input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search artists or genres" />
          </label>
        </div>

        {loading ? <div className={styles.empty}><h3>Loading the Aureon artists…</h3></div> : visibleArtists.length ? (
          <div className={styles.artistGrid}>
            {visibleArtists.map(artist => {
              const portrait = artist.profileImageUrl || artist.image || artist.featuredImageUrl || artist.coverImageUrl;
              const image = portrait || artist.logoUrl || getArtwork(artist);
              const genres = artist.genres?.length ? artist.genres : artist.genre ? [artist.genre] : [];
              const description = text(artist.description || artist.bio);
              return (
                <Link href={`/artists/${artist.slug}`} className={styles.artistCard} key={artist.id} aria-label={`Explore ${artist.name}`}>
                  <div className={`${styles.artwork} ${portrait ? styles.portrait : styles.identity}`}>
                    <ArtworkImage src={image} alt={portrait ? `Portrait of ${artist.name}` : `${artist.name} artist artwork`} fill sizes="(max-width: 680px) 100vw, (max-width: 1050px) 50vw, 33vw" />
                    <span className={styles.artistLabel}>Aureon artist</span>
                  </div>
                  <div className={styles.cardCopy}>
                    <div className={styles.artistTitleRow}><h3>{artist.name}</h3><ArrowUpRight size={18} aria-hidden="true" /></div>
                    {genres.length > 0 && <p className={styles.genres}>{genres.join(' · ')}</p>}
                    {description && <p className={styles.description}>{description}</p>}
                    <span className={styles.cardLink}>Explore artist <span aria-hidden="true">→</span></span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <h3>{artists.length ? 'No artists match that search.' : 'No published artists yet.'}</h3>
            <p>{artists.length ? 'Try another artist name or genre.' : 'Published artist profiles will appear here when they are available in the Aureon catalogue.'}</p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
