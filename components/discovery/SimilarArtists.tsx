'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, Plus, Users } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { recommendArtists, type RecommendationEntity } from '@/lib/recommendations';
import { trackAnalytics } from '@/lib/track-analytics';
import styles from './SimilarArtists.module.css';

type Artist = RecommendationEntity & {
  name?: string;
  title?: string;
  slug?: string;
  genre?: string;
  style?: string | string[];
  sound?: string | string[];
  instrumentation?: string | string[];
  instruments?: string | string[];
  logoUrl?: string;
  profileImageUrl?: string;
  image?: string;
  monthlyPlays?: number;
  listenerCrossover?: string[];
  similarArtistIds?: string[];
  details?: Record<string, any>;
};

type Song = RecommendationEntity & {
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  title?: string;
  name?: string;
  slug?: string;
  releaseDate?: unknown;
  publishedAt?: unknown;
  plays30d?: number;
  monthlyPlays?: number;
  recentPlays?: number;
  details?: Record<string, any>;
};

type Props = {
  currentArtist: Artist;
  artists: Artist[];
  songs: Song[];
};

const normalise = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const list = (value: unknown) => Array.isArray(value) ? value.map(normalise).filter(Boolean) : String(value || '').split(/[,/|;]+/).map(normalise).filter(Boolean);
const dateValue = (value: unknown) => {
  const candidate: any = value;
  if (candidate?.toDate) return candidate.toDate() as Date;
  if (candidate?.seconds) return new Date(candidate.seconds * 1000);
  const parsed = value ? new Date(value as string) : new Date(0);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};
const compact = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, value));

function artistKeys(artist: Artist) {
  return new Set([artist.id, artist.slug, artist.name, artist.title, artist.details?.artistCode].map(normalise).filter(Boolean));
}

function belongsTo(song: Song, artist: Artist) {
  const details = song.details || {};
  const keys = artistKeys(artist);
  return [song.artistId, song.artistSlug, song.artistName, details.artistId, details.artistSlug, details.artistName]
    .map(normalise).filter(Boolean).some(value => keys.has(value));
}

function instrumentationScore(seed: Artist, candidate: Artist) {
  const a = new Set(list(seed.instrumentation || seed.instruments || seed.details?.instrumentation || seed.details?.instruments || seed.sound || seed.details?.sound));
  const b = new Set(list(candidate.instrumentation || candidate.instruments || candidate.details?.instrumentation || candidate.details?.instruments || candidate.sound || candidate.details?.sound));
  if (!a.size || !b.size) return 0;
  let matches = 0;
  a.forEach(value => { if (b.has(value)) matches += 1; });
  return matches / Math.max(a.size, b.size);
}

function crossoverScore(seed: Artist, candidate: Artist) {
  const candidateKeys = artistKeys(candidate);
  const seedKeys = artistKeys(seed);
  const seedLinks = list(seed.listenerCrossover || seed.similarArtistIds || seed.details?.listenerCrossover || seed.details?.similarArtistIds);
  const candidateLinks = list(candidate.listenerCrossover || candidate.similarArtistIds || candidate.details?.listenerCrossover || candidate.details?.similarArtistIds);
  const explicit = seedLinks.some(value => candidateKeys.has(value)) || candidateLinks.some(value => seedKeys.has(value));
  const seedListeners = new Set(list(seed.details?.listenerIds || seed.details?.audienceIds));
  const candidateListeners = new Set(list(candidate.details?.listenerIds || candidate.details?.audienceIds));
  let overlap = 0;
  if (seedListeners.size && candidateListeners.size) {
    let matches = 0;
    seedListeners.forEach(value => { if (candidateListeners.has(value)) matches += 1; });
    overlap = matches / Math.max(seedListeners.size, candidateListeners.size);
  }
  return explicit ? 1 : overlap;
}

export function SimilarArtists({ currentArtist, artists, songs }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  const recommendations = useMemo(() => {
    return recommendArtists(artists, { seed: currentArtist, limit: 12 })
      .map(result => {
        const instrumentation = instrumentationScore(currentArtist, result.item as Artist);
        const crossover = crossoverScore(currentArtist, result.item as Artist);
        return { ...result, score: result.score + instrumentation * 16 + crossover * 20, instrumentation, crossover };
      })
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, 8);
  }, [artists, currentArtist]);

  useEffect(() => {
    if (!user || !recommendations.length) { setFollowed({}); return; }
    const unsubscribers = recommendations.map(({ item }) => {
      const id = String(item.id || item.slug || item.name || item.title || '');
      if (!id) return () => undefined;
      return onSnapshot(doc(firestore, 'members', user.uid, 'followingArtists', id), snapshot => {
        setFollowed(current => ({ ...current, [id]: snapshot.exists() }));
      });
    });
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [recommendations, user]);

  if (!recommendations.length) return null;

  async function toggleFollow(artist: Artist) {
    const id = String(artist.id || artist.slug || artist.name || artist.title || '');
    if (!id) return;
    if (!user) { window.location.href = '/account'; return; }
    setBusy(id);
    try {
      const reference = doc(firestore, 'members', user.uid, 'followingArtists', id);
      if (followed[id]) {
        await deleteDoc(reference);
        trackAnalytics({ eventType: 'artist_unfollowed', entityType: 'artist', entityId: id, title: String(artist.name || artist.title || '') });
      } else {
        await setDoc(reference, { artistId: id, artistSlug: artist.slug || '', artistName: artist.name || artist.title || '', followedAt: serverTimestamp() });
        trackAnalytics({ eventType: 'artist_followed', entityType: 'artist', entityId: id, title: String(artist.name || artist.title || '') });
      }
    } finally {
      setBusy('');
    }
  }

  return <section className={styles.section} aria-labelledby="similar-artists-title">
    <div className={styles.heading}><div><p className="eyebrow"><Users size={15}/> Music discovery</p><h2 id="similar-artists-title">Fans Also Like</h2></div><p>Artists connected by sound, style, instrumentation and listener behaviour.</p></div>
    <div className={styles.grid}>{recommendations.map(({ item, confidence }) => {
      const artist = item as Artist;
      const id = String(artist.id || artist.slug || artist.name || artist.title || '');
      const name = String(artist.name || artist.title || 'Aureon artist');
      const slug = String(artist.slug || id);
      const image = String(artist.logoUrl || artist.profileImageUrl || artist.image || artist.details?.logoUrl || artist.details?.profileImageUrl || '/images/branding/Aureon_Header_Logo.png');
      const artistSongs = songs.filter(song => belongsTo(song, artist));
      const latest = [...artistSongs].sort((a, b) => dateValue(b.releaseDate || b.publishedAt || b.details?.releaseDate || b.details?.publishedAt).getTime() - dateValue(a.releaseDate || a.publishedAt || a.details?.releaseDate || a.details?.publishedAt).getTime())[0];
      const songPlays = artistSongs.reduce((sum, song) => sum + Number(song.plays30d ?? song.monthlyPlays ?? song.recentPlays ?? song.details?.plays30d ?? song.details?.monthlyPlays ?? song.details?.recentPlays ?? 0), 0);
      const monthlyPlays = Number(artist.monthlyPlays ?? artist.details?.monthlyPlays ?? artist.details?.plays30d ?? songPlays);
      const isFollowed = Boolean(followed[id]);
      return <article className={styles.card} key={id}>
        <Link className={styles.imageLink} href={`/artists/${slug}`} aria-label={`Open ${name} artist profile`}>
          <Image src={image} alt={`${name} artist image`} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw"/>
        </Link>
        <div className={styles.copy}>
          <p className={styles.match}>{Math.round(confidence * 100)}% match</p>
          <Link href={`/artists/${slug}`}><h3>{name}</h3></Link>
          <p>{compact(monthlyPlays)} monthly plays</p>
          <p className={styles.release}>Latest release<br/><strong>{latest?.title || latest?.name || 'New music coming soon'}</strong></p>
          <button type="button" className={isFollowed ? styles.following : styles.follow} disabled={busy === id} onClick={() => void toggleFollow(artist)}>
            {isFollowed ? <Check size={15}/> : <Plus size={15}/>} {busy === id ? 'Updating…' : isFollowed ? 'Following' : 'Follow'}
          </button>
        </div>
      </article>;
    })}</div>
  </section>;
}
