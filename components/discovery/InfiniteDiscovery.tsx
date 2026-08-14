'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Album, Clock3, Disc3, History, ListMusic, Music2, Play, Radio, Sparkles, TrendingUp, Users } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { firebaseAuth } from '@/lib/firebase-client';
import { getArtwork } from '@/lib/get-artwork';
import { getPreviewUrl } from '@/lib/get-preview-url';
import { recommendAlbums, recommendArtists, recommendSongs } from '@/lib/recommendations';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './InfiniteDiscovery.module.css';

type RecordData = PublicRecord & { [key: string]: any; details?: Record<string, any> };
type MemberLibrary = { continueListening?: any; recentlyPlayed?: any[]; favouriteSongIds?: string[]; favouriteArtists?: string[] };

const text = (item: RecordData, keys: string[]) => {
  const details = item.details || {};
  for (const key of keys) {
    const value = item[key] ?? details[key];
    if (value !== undefined && value !== null && value !== '') return String(value).trim();
  }
  return '';
};
const dateValue = (value: any) => value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : new Date(value || 0));
const formatTime = (value: number) => Number.isFinite(value) && value > 0 ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';

const PUBLIC_CONTENT = /^\/$|^\/(artists|music|songs|videos|news|genres|charts|discover)(\/|$)/;

export function InfiniteDiscovery() {
  const pathname = usePathname();
  const { items: songs } = usePublishedCollection<RecordData>('songs', []);
  const { items: artists } = usePublishedCollection<RecordData>('artists', []);
  const { items: albums } = usePublishedCollection<RecordData>('albums', []);
  const [user, setUser] = useState<User | null>(null);
  const [library, setLibrary] = useState<MemberLibrary>({});
  const [trending, setTrending] = useState<RecordData[]>([]);

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) setLibrary({});
  }), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/member/library', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json();
        if (!cancelled && response.ok) setLibrary(data);
      } catch { if (!cancelled) setLibrary({}); }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener('aureon-continue-listening-updated', refresh);
    window.addEventListener('aureon-recently-played-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('aureon-continue-listening-updated', refresh);
      window.removeEventListener('aureon-recently-played-updated', refresh);
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/discovery/trending?window=7d', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!cancelled) setTrending(Array.isArray(data?.songs) ? data.songs.slice(0, 4) : []); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const history = useMemo(() => (library.recentlyPlayed || []).map(item => ({
    entityId: String(item.songId || item.id || ''), entityType: 'song' as const, artistId: String(item.artistId || item.artist || ''),
    genre: String(item.genre || ''), mood: String(item.mood || ''), playCount: Number(item.playCount || 1), progressPercent: Number(item.progressPercent || 0), playedAt: item.playedAt,
  })), [library.recentlyPlayed]);
  const context = useMemo(() => ({
    listeningHistory: history,
    favouriteIds: library.favouriteSongIds || [],
    followedArtistIds: library.favouriteArtists || [],
    limit: 4,
  }), [history, library.favouriteSongIds, library.favouriteArtists]);

  const likedSongs = useMemo(() => recommendSongs(songs, context).map(result => result.item), [songs, context]);
  const recommendedArtists = useMemo(() => recommendArtists(artists, context).map(result => result.item), [artists, context]);
  const recommendedAlbums = useMemo(() => recommendAlbums(albums, context).map(result => result.item), [albums, context]);
  const newReleases = useMemo(() => [...albums, ...songs].sort((a, b) => {
    const ad = dateValue(text(a, ['releaseDate', 'publishedAt', 'createdAt'])).getTime();
    const bd = dateValue(text(b, ['releaseDate', 'publishedAt', 'createdAt'])).getTime();
    return bd - ad;
  }).slice(0, 4), [albums, songs]);

  if (!PUBLIC_CONTENT.test(pathname)) return null;

  const continueItem = library.continueListening;
  const recent = (library.recentlyPlayed || []).slice(0, 4);
  const hour = new Date().getHours();
  const playlistNames = hour >= 21 || hour < 5 ? ['Late Night Drive', 'Relax', 'Acoustic Evenings'] : hour < 12 ? ['Sunday Morning', 'Focus', 'Acoustic Evenings'] : hour < 18 ? ['Workout', 'Road Trip', 'Country Roads'] : ['Deep House Essentials', 'Relax', 'Road Trip'];

  const songCard = (item: RecordData, keyPrefix: string) => {
    const id = String(item.id || '');
    const title = text(item, ['title', 'name']) || 'Untitled track';
    const artist = text(item, ['artistName', 'artist']) || 'Aureon Music Group';
    const slug = text(item, ['slug']) || id;
    const preview = getPreviewUrl(item);
    return <article className={styles.miniCard} key={`${keyPrefix}-${id}`}>
      <Link className={styles.artwork} href={`/songs/${slug}`}><ArtworkImage src={getArtwork(item)} alt={`${title} artwork`} fill sizes="72px" /></Link>
      <div className={styles.copy}><strong><Link href={`/songs/${slug}`}>{title}</Link></strong><span>{artist}</span></div>
      {preview ? <LatestPlayButton size="small" title={title} src={preview} buttonLabel="Play" showPurchase={false} analytics={{ id, artistId: text(item, ['artistId']), artistName: artist }} /> : <Link className={styles.arrow} href={`/songs/${slug}`}>→</Link>}
    </article>;
  };

  return <section className={styles.shell} aria-labelledby="infinite-discovery-heading">
    <div className={styles.header}><div><p><Sparkles size={15}/> Infinite discovery</p><h2 id="infinite-discovery-heading">Keep discovering</h2></div><Link href="/discover">Open Discover →</Link></div>

    <div className={styles.lane}><div className={styles.laneTitle}><Music2/><div><h3>You May Like</h3><p>Contextual songs selected from your activity and the current catalogue.</p></div></div><div className={styles.rail}>{likedSongs.map(item => songCard(item, 'like'))}</div></div>

    <div className={styles.twoCol}>
      <div className={styles.personalCard}><div className={styles.laneTitle}><Radio/><div><h3>Continue Listening</h3><p>Resume from your exact position.</p></div></div>{continueItem?.songId ? <Link className={styles.resume} href="/library"><ArtworkImage src={continueItem.coverImageUrl} alt="" width={62} height={62}/><div><strong>{continueItem.title}</strong><span>{continueItem.artist}</span><small>{Math.round(Number(continueItem.progressPercent || 0))}% complete</small></div><Play/></Link> : <Link className={styles.emptyLink} href={user ? '/library' : '/account'}>{user ? 'Start listening to create your queue →' : 'Sign in to continue listening →'}</Link>}</div>
      <div className={styles.personalCard}><div className={styles.laneTitle}><History/><div><h3>Recently Played</h3><p>Your latest listening activity.</p></div></div>{recent.length ? <div className={styles.recentList}>{recent.map(item => <Link href={`/songs/${item.songId || item.id}`} key={item.songId || item.id}><ArtworkImage src={item.coverImageUrl} alt="" width={44} height={44}/><span><strong>{item.title}</strong><small><Clock3 size={11}/> {formatTime(Number(item.progressSeconds || 0))}</small></span></Link>)}</div> : <Link className={styles.emptyLink} href={user ? '/music' : '/account'}>{user ? 'Explore music to build your history →' : 'Create an account for listening history →'}</Link>}</div>
    </div>

    <div className={styles.lane}><div className={styles.laneTitle}><TrendingUp/><div><h3>Trending Now</h3><p>Songs building momentum across Aureon.</p></div></div><div className={styles.rail}>{(trending.length ? trending : songs.slice(0, 4)).map(item => songCard(item, 'trend'))}</div></div>

    <div className={styles.threeCol}>
      <div className={styles.collection}><div className={styles.collectionHead}><Users/><h3>Recommended Artists</h3></div>{recommendedArtists.slice(0, 4).map(item => <Link href={`/artists/${text(item, ['slug']) || item.id}`} key={item.id}><ArtworkImage src={getArtwork(item)} alt="" width={48} height={48}/><span>{text(item, ['name', 'title'])}</span></Link>)}</div>
      <div className={styles.collection}><div className={styles.collectionHead}><Album/><h3>Recommended Albums</h3></div>{recommendedAlbums.slice(0, 4).map(item => <Link href={`/music/${text(item, ['slug']) || item.id}`} key={item.id}><ArtworkImage src={getArtwork(item)} alt="" width={48} height={48}/><span>{text(item, ['title', 'name'])}</span></Link>)}</div>
      <div className={styles.collection}><div className={styles.collectionHead}><ListMusic/><h3>Recommended Playlists</h3></div>{playlistNames.map(name => <Link href="/discover#recommended-playlists" key={name}><span className={styles.playlistIcon}><Disc3/></span><span>{name}</span></Link>)}</div>
    </div>

    <div className={styles.lane}><div className={styles.laneTitle}><Disc3/><div><h3>New Releases</h3><p>The newest singles, albums, EPs and special editions.</p></div></div><div className={styles.releaseRail}>{newReleases.map(item => { const isAlbum = albums.some(album => album.id === item.id); const slug = text(item, ['slug']) || item.id; return <Link href={isAlbum ? `/music/${slug}` : `/songs/${slug}`} className={styles.release} key={`${isAlbum ? 'album' : 'song'}-${item.id}`}><ArtworkImage src={getArtwork(item)} alt="" fill sizes="160px"/><span>{text(item, ['title', 'name'])}</span></Link>; })}</div></div>
  </section>;
}