'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowUpRight, FolderOpen, Search } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import type { GenreCatalogueCard } from '@/lib/genre-catalogue';
import styles from './GenreDirectory.module.css';

export function GenreDirectory({ genres }: { genres: GenreCatalogueCard[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'featured' | 'tracks'>('featured');
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? genres.filter(genre => `${genre.label} ${genre.description}`.toLocaleLowerCase().includes(query))
      : genres;
    return sort === 'tracks' ? [...filtered].sort((a, b) => b.trackCount - a.trackCount || a.label.localeCompare(b.label)) : filtered;
  }, [genres, search, sort]);

  return <div className={styles.directory}>
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search size={17} aria-hidden="true" />
        <span className={styles.srOnly}>Search Aureon genres</span>
        <input value={search} onChange={event => setSearch(event.target.value)} type="search" placeholder="Search genres" />
      </label>
      <label className={styles.sort}>
        <span>Sort</span>
        <select value={sort} onChange={event => setSort(event.target.value as 'featured' | 'tracks')} aria-label="Sort genres">
          <option value="featured">Aureon genres</option>
          <option value="tracks">Most tracks</option>
        </select>
      </label>
    </div>

    {visible.length ? <div className={styles.grid}>
      {visible.map(genre => <Link href={`/genres/${genre.slug}`} className={styles.folderCard} key={genre.slug}>
        <span className={styles.folderTab} aria-hidden="true" />
        <div className={styles.artwork}>
          {genre.artwork ? <ArtworkImage src={genre.artwork} alt={`${genre.label} music artwork`} fill sizes="(max-width: 620px) 100vw, (max-width: 1000px) 50vw, 33vw" /> : <div className={styles.artworkFallback} aria-hidden="true"><FolderOpen size={38} /></div>}
          <span className={styles.shade} aria-hidden="true" />
          <div className={styles.cardCopy}>
            <span className={styles.eyebrow}>Aureon catalogue</span>
            <h2>{genre.label}</h2>
            <p>{genre.trackCount} {genre.trackCount === 1 ? 'published track' : 'published tracks'}</p>
            <span className={styles.open}>Browse genre <ArrowUpRight size={16} /></span>
          </div>
        </div>
        <p className={styles.description}>{genre.description}</p>
      </Link>)}
    </div> : <div className={styles.empty}><h2>No genres match that search.</h2><p>Try a different genre name.</p></div>}
    <p className={styles.countNote}>Counts are based on unique published songs in the Aureon catalogue.</p>
  </div>;
}
