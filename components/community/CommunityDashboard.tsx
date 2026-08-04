'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Award, BookOpen, Check, Globe2, Heart, Lock, Music2, Sparkles, Star, Users } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import styles from './CommunityDashboard.module.css';

type Row = { id: string; [key: string]: any };
type Achievement = { id: string; title: string; description: string; icon: string; unlocked: boolean; progress: number; target: number };
type DashboardData = {
  profile: { handle: string; displayName: string; bio: string; avatarUrl: string; favouriteGenres: string[]; publicProfile: boolean; showListeningStats: boolean; showFollowing: boolean; badges: string[] };
  stats: { songsPlayed: number; listeningMinutes: number; playlists: number; publicPlaylists: number; followedArtists: number; favouriteSongs: number; collections: number };
  playlists: Row[];
  following: Row[];
  favourites: Row[];
  collections: Row[];
  achievements: Achievement[];
};

async function authFetch(path: string, init?: RequestInit) {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Sign in to use Community.');
  const token = await user.getIdToken();
  const response = await fetch(path, { ...init, headers: { ...(init?.headers || {}), authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Community request failed.');
  return data;
}

export function CommunityDashboard() {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [collectionPublic, setCollectionPublic] = useState(false);
  const [profile, setProfile] = useState({ handle: '', displayName: '', bio: '', avatarUrl: '', favouriteGenres: '', publicProfile: false, showListeningStats: true, showFollowing: true });

  const load = useCallback(async () => {
    if (!firebaseAuth.currentUser) return;
    setBusy('loading');
    try {
      const next = await authFetch('/api/member/community');
      setData(next);
      setProfile({
        handle: next.profile.handle || '',
        displayName: next.profile.displayName || '',
        bio: next.profile.bio || '',
        avatarUrl: next.profile.avatarUrl || '',
        favouriteGenres: Array.isArray(next.profile.favouriteGenres) ? next.profile.favouriteGenres.join(', ') : '',
        publicProfile: next.profile.publicProfile === true,
        showListeningStats: next.profile.showListeningStats !== false,
        showFollowing: next.profile.showFollowing !== false,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Community.');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => onAuthStateChanged(firebaseAuth, current => { setUser(current); if (current) void load(); else setData(null); }), [load]);

  const hours = useMemo(() => Math.floor(Number(data?.stats.listeningMinutes || 0) / 60), [data]);

  async function action(payload: Record<string, unknown>, key: string) {
    setBusy(key); setMessage('');
    try { await authFetch('/api/member/community', { method: 'POST', body: JSON.stringify(payload) }); await load(); setMessage('Community updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update Community.'); }
    finally { setBusy(''); }
  }

  if (!user) return null;
  if (!data) return <section className={styles.shell}><p className={styles.kicker}>Aureon Community</p><h2>{busy === 'loading' ? 'Preparing your community space…' : 'Community unavailable'}</h2>{message && <p className={styles.message}>{message}</p>}</section>;

  return <section className={styles.shell} aria-labelledby="community-dashboard-title">
    <header className={styles.hero}>
      <div><p className={styles.kicker}>Aureon Community</p><h2 id="community-dashboard-title">Your place in the music.</h2><p>Curate your identity, share playlists and celebrate the music that shapes your Aureon journey.</p></div>
      <div className={styles.heroLinks}>{profile.publicProfile && profile.handle ? <Link href={`/community/${profile.handle}`}>View public profile</Link> : null}<Link href="/community">Explore Community</Link></div>
    </header>

    {message && <p className={styles.message}>{message}</p>}

    <div className={styles.metrics}>
      <article><Music2/><strong>{data.stats.songsPlayed}</strong><span>Songs explored</span></article>
      <article><Sparkles/><strong>{hours}h</strong><span>Listening time</span></article>
      <article><Users/><strong>{data.stats.followedArtists}</strong><span>Artists followed</span></article>
      <article><Heart/><strong>{data.stats.favouriteSongs}</strong><span>Favourite songs</span></article>
      <article><BookOpen/><strong>{data.stats.publicPlaylists}</strong><span>Public playlists</span></article>
    </div>

    <div className={styles.grid}>
      <article className={styles.panel}>
        <div className={styles.panelTitle}><Globe2/><div><p className={styles.kicker}>Public identity</p><h3>User profile</h3></div></div>
        <div className={styles.form}>
          <label>Display name<input value={profile.displayName} onChange={event => setProfile(current => ({ ...current, displayName: event.target.value }))}/></label>
          <label>Community handle<input value={profile.handle} onChange={event => setProfile(current => ({ ...current, handle: event.target.value }))} placeholder="miguel-pinho"/></label>
          <label>Short bio<textarea value={profile.bio} maxLength={240} onChange={event => setProfile(current => ({ ...current, bio: event.target.value }))}/></label>
          <label>Avatar image URL<input value={profile.avatarUrl} onChange={event => setProfile(current => ({ ...current, avatarUrl: event.target.value }))}/></label>
          <label>Favourite genres<input value={profile.favouriteGenres} onChange={event => setProfile(current => ({ ...current, favouriteGenres: event.target.value }))} placeholder="Country Pop, Deep House"/></label>
          <label className={styles.toggle}><input type="checkbox" checked={profile.publicProfile} onChange={event => setProfile(current => ({ ...current, publicProfile: event.target.checked }))}/><span>Make my profile public</span></label>
          <label className={styles.toggle}><input type="checkbox" checked={profile.showListeningStats} onChange={event => setProfile(current => ({ ...current, showListeningStats: event.target.checked }))}/><span>Show listening milestones</span></label>
          <label className={styles.toggle}><input type="checkbox" checked={profile.showFollowing} onChange={event => setProfile(current => ({ ...current, showFollowing: event.target.checked }))}/><span>Show artists I follow</span></label>
          <button disabled={Boolean(busy)} onClick={() => void action({ action: 'update_profile', ...profile, favouriteGenres: profile.favouriteGenres.split(',').map(item => item.trim()).filter(Boolean) }, 'profile')}>{busy === 'profile' ? 'Saving…' : 'Save community profile'}</button>
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelTitle}><Award/><div><p className={styles.kicker}>Progress</p><h3>Achievements & fan badges</h3></div></div>
        <div className={styles.achievements}>{data.achievements.map(item => <div className={`${styles.achievement} ${item.unlocked ? styles.unlocked : ''}`} key={item.id}><span>{item.unlocked ? item.icon : <Lock size={16}/>}</span><div><strong>{item.title}</strong><small>{item.description}</small><div className={styles.progress}><i style={{ width: `${Math.min(100, item.progress / item.target * 100)}%` }}/></div><em>{item.progress} / {item.target}</em></div></div>)}</div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelTitle}><BookOpen/><div><p className={styles.kicker}>Share your taste</p><h3>Public playlists</h3></div></div>
        {data.playlists.length ? <div className={styles.rows}>{data.playlists.map(item => <div className={styles.row} key={item.id}><div><strong>{item.name || 'Untitled playlist'}</strong><small>{Array.isArray(item.songIds) ? item.songIds.length : 0} songs</small></div><button className={item.isPublic ? styles.public : styles.private} disabled={Boolean(busy)} onClick={() => void action({ action: 'playlist_visibility', playlistId: item.id, isPublic: item.isPublic !== true, description: item.description || '' }, `playlist-${item.id}`)}>{item.isPublic ? <><Check/> Public</> : <><Lock/> Private</>}</button></div>)}</div> : <p className={styles.empty}>Create playlists in your account, then choose which ones become public.</p>}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelTitle}><Star/><div><p className={styles.kicker}>Personal curation</p><h3>Collections</h3></div></div>
        <div className={styles.form}><label>Collection name<input value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)} placeholder="Songs for the open road"/></label><label>Description<input value={collectionDescription} onChange={event => setCollectionDescription(event.target.value)}/></label><label className={styles.toggle}><input type="checkbox" checked={collectionPublic} onChange={event => setCollectionPublic(event.target.checked)}/><span>Make collection public</span></label><button disabled={!collectionTitle.trim() || Boolean(busy)} onClick={async () => { await action({ action: 'create_collection', title: collectionTitle, description: collectionDescription, isPublic: collectionPublic }, 'collection'); setCollectionTitle(''); setCollectionDescription(''); setCollectionPublic(false); }}>Create collection</button></div>
        {data.collections.length ? <div className={styles.rows}>{data.collections.map(item => <div className={styles.row} key={item.id}><div><strong>{item.title}</strong><small>{item.isPublic ? 'Public collection' : 'Private collection'}</small></div><button className={styles.delete} onClick={() => void action({ action: 'delete_collection', collectionId: item.id }, `delete-${item.id}`)}>Delete</button></div>)}</div> : null}
      </article>

      <article className={`${styles.panel} ${styles.wide}`}>
        <div className={styles.panelTitle}><Users/><div><p className={styles.kicker}>Your music circle</p><h3>Artists followed</h3></div></div>
        {data.following.length ? <div className={styles.chips}>{data.following.map(item => <span key={item.id}>{item.artistName || 'Aureon artist'}</span>)}</div> : <p className={styles.empty}>Follow artists from their profiles and Fans Also Like recommendations.</p>}
      </article>
    </div>
  </section>;
}
