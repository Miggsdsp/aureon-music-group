'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { BrainCircuit, Sparkles } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { getArtwork } from '@/lib/get-artwork';
import { listeningMoment, personalisedSongs, type PersonalisationProfile } from '@/lib/personalization';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import { useDiscoveryImpressions } from '@/lib/discovery-analytics';
import styles from './PersonalisedHome.module.css';

type Song = PublicRecord & {
  title?: string;
  name?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artist?: string;
  artistSlug?: string;
  albumId?: string;
  albumTitle?: string;
  previewUrl?: string;
  price?: number;
  promotional?: boolean;
  genre?: string;
  mood?: string;
  details?: Record<string, any>;
};

type MemberProfile = PersonalisationProfile & { displayName: string };

const emptyProfile: MemberProfile = {
  displayName: '',
  listeningHistory: [],
  favouriteSongIds: [],
  followedArtistIds: [],
  favouriteGenres: [],
  playlists: [],
};

function text(value: unknown) { return String(value || '').trim(); }
function timestamp(value: any) {
  if (value?.toDate) return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

async function loadProfile(user: User): Promise<MemberProfile> {
  const memberRef = doc(firestore, 'members', user.uid);
  const [memberSnapshot, recentSnapshot, favouriteSnapshot, followingSnapshot, playlistSnapshot] = await Promise.all([
    getDoc(memberRef),
    getDocs(query(collection(memberRef, 'recentlyPlayed'), orderBy('lastPlayedAt', 'desc'), limit(100))).catch(() => getDocs(query(collection(memberRef, 'recentlyPlayed'), limit(100)))),
    getDocs(query(collection(memberRef, 'favoriteSongs'), limit(100))),
    getDocs(query(collection(memberRef, 'followingArtists'), limit(100))),
    getDocs(query(collection(memberRef, 'playlists'), limit(50))),
  ]);
  const member = memberSnapshot.data() || {};
  const recentlyPlayed = recentSnapshot.docs.map(entry => ({ id: entry.id, ...entry.data() } as Record<string, any>));
  return {
    displayName: text(member.communityDisplayName || member.name || user.displayName).split(' ')[0],
    favouriteGenres: Array.isArray(member.favouriteGenres) ? member.favouriteGenres.map(text).filter(Boolean) : [],
    favouriteSongIds: favouriteSnapshot.docs.map(entry => text(entry.data().songId || entry.id)).filter(Boolean),
    followedArtistIds: followingSnapshot.docs.map(entry => text(entry.data().artistId || entry.data().artistSlug || entry.id)).filter(Boolean),
    playlists: playlistSnapshot.docs.map(entry => {
      const data = entry.data();
      return {
        id: entry.id,
        name: text(data.name || data.title),
        songIds: Array.isArray(data.songIds) ? data.songIds.map(text) : [],
        genres: Array.isArray(data.genres) ? data.genres.map(text) : [],
        moods: Array.isArray(data.moods) ? data.moods.map(text) : [],
      };
    }),
    listeningHistory: recentlyPlayed.map(item => ({
      entityId: text(item.songId || item.id),
      entityType: 'song' as const,
      artistId: text(item.artistId || item.artistSlug || item.artistName),
      genre: text(item.genre || item.details?.genre),
      subgenre: text(item.subgenre || item.details?.subgenre),
      mood: text(item.mood || item.details?.mood),
      playedAt: timestamp(item.lastPlayedAt || item.updatedAt || item.playedAt),
      playCount: Number(item.playCount || item.plays || 1),
      completed: item.completed === true || Number(item.progressPercent || 0) >= 90,
      progressPercent: Number(item.progressPercent || 0),
    })),
  };
}

export function PersonalisedHome() {
  const { items: songs, loading } = usePublishedCollection<Song>('songs', []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MemberProfile>(emptyProfile);
  const [profileLoading, setProfileLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) { setProfile(emptyProfile); setProfileLoading(false); return; }
    setProfileLoading(true);
    void loadProfile(current).then(setProfile).finally(() => setProfileLoading(false));
  }), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const moment = useMemo(() => listeningMoment(now), [now]);
  const recommendations = useMemo(() => personalisedSongs(songs, profile, now, 8), [songs, profile, now]);
  const hasPersonalSignals = Boolean(profile.listeningHistory.length || profile.favouriteSongIds.length || profile.followedArtistIds.length || profile.favouriteGenres.length || profile.playlists.length);
  const impressions = useMemo(() => recommendations.map((result, index) => ({
    entity: { id: text(result.item.id), type: 'song' as const, title: text(result.item.title || result.item.name) },
    context: { source: 'personalised_home', algorithm: 'behavioural_time_context_v1', position: index + 1, confidence: result.confidence },
  })), [recommendations]);
  useDiscoveryImpressions(impressions);

  if (loading || profileLoading || !recommendations.length) return null;

  return <section className={styles.section} aria-labelledby="personalised-home-title">
    <div className={styles.heading}>
      <div>
        <p className={styles.eyebrow}><BrainCircuit size={15}/> AI personalisation</p>
        <h2 id="personalised-home-title">{profile.displayName ? `${moment.title}, ${profile.displayName}` : moment.title}</h2>
        <p>{hasPersonalSignals ? moment.description : 'Aureon is learning your taste. Play, like and follow music to make this selection increasingly personal.'}</p>
      </div>
      <Link href={user ? '/discover' : '/account?mode=signup'}>{user ? 'Refine your discovery →' : 'Create a free account →'}</Link>
    </div>
    <div className={styles.rail}>
      {recommendations.map((result, index) => {
        const song = result.item as Song;
        const title = text(song.title || song.name || 'Untitled track');
        const details = song.details || {};
        const artist = text(song.artistName || song.artist || details.artistName || 'Aureon Music Group');
        const artwork = getArtwork(song);
        const preview = text(song.previewUrl || details.previewUrl);
        const slug = text(song.slug || song.id);
        const artistSlug = text(song.artistSlug || details.artistSlug);
        return <article className={styles.card} key={song.id}>
          <Link className={styles.artwork} href={`/songs/${slug}`}><ArtworkImage src={artwork} alt={`${title} artwork`} fill sizes="(max-width: 700px) 72vw, (max-width: 1100px) 34vw, 22vw" loading="lazy"/></Link>
          <div className={styles.body}>
            <p className={styles.reason}><Sparkles size={12}/>{result.personalReason}</p>
            <Link href={`/songs/${slug}`}><h3>{title}</h3></Link>
            {artistSlug ? <Link className={styles.artist} href={`/artists/${artistSlug}`}>{artist}</Link> : <span className={styles.artist}>{artist}</span>}
            <LatestPlayButton
              size="small"
              title={title}
              src={preview}
              buttonLabel="Play preview"
              showPurchase={false}
              purchase={{ id: song.id, title, artist, image: artwork, price: Number(song.price ?? details.price ?? .99), promotional: Boolean(song.promotional ?? details.promotional), slug, artistSlug }}
              analytics={{ id: song.id, artistId: text(song.artistId || details.artistId), artistName: artist, albumId: text(song.albumId || details.albumId), albumTitle: text(song.albumTitle || details.albumTitle) }}
              discovery={{ source: 'personalised_home', algorithm: 'behavioural_time_context_v1', position: index + 1, confidence: result.confidence }}
            />
          </div>
        </article>;
      })}
    </div>
  </section>;
}
