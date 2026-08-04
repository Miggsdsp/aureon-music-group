import { notFound } from 'next/navigation';
import { adminFirestore } from '@/lib/firebase-admin';
import { communityHandle, computeCommunityAchievements } from '@/lib/community';
import styles from '../community.module.css';

export const dynamic = 'force-dynamic';

type Row = { id: string; [key: string]: any };
async function rows(reference: FirebaseFirestore.CollectionReference, limit = 100): Promise<Row[]> { const snapshot = await reference.limit(limit).get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); }

export default async function CommunityProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: rawHandle } = await params;
  const handle = communityHandle(rawHandle);
  const profileSnapshot = await adminFirestore.collection('communityProfiles').doc(handle).get();
  if (!profileSnapshot.exists || profileSnapshot.data()?.public !== true) notFound();
  const profile = profileSnapshot.data() || {};
  const uid = String(profile.uid || '');
  if (!uid) notFound();
  const memberRef = adminFirestore.collection('members').doc(uid);
  const [memberSnapshot, playlists, collections, following, favourites, recent] = await Promise.all([
    memberRef.get(), rows(memberRef.collection('playlists')), rows(memberRef.collection('collections')), rows(memberRef.collection('followingArtists')), rows(memberRef.collection('favoriteSongs')), rows(memberRef.collection('recentlyPlayed')),
  ]);
  const member = memberSnapshot.data() || {};
  const publicPlaylists = playlists.filter(item => item.isPublic === true);
  const publicCollections = collections.filter(item => item.isPublic === true);
  const listeningSeconds = recent.reduce((sum, item) => sum + Number(item.progressSeconds || item.listenedSeconds || 0), 0);
  const achievements = computeCommunityAchievements({ songsPlayed: new Set(recent.map(item => String(item.songId || item.id))).size, listeningMinutes: Math.floor(listeningSeconds / 60), playlists: playlists.length, followedArtists: following.length, favouriteSongs: favourites.length, referrals: Number(member.referralConversions || 0) }).filter(item => item.unlocked);

  return <main className={styles.page}>
    <section className={styles.profileHead}>
      {profile.avatarUrl ? <img className={styles.avatar} src={String(profile.avatarUrl)} alt="" /> : <div className={styles.avatar} />}
      <div><p className={styles.kicker}>Aureon Community</p><h1>{profile.displayName || 'Aureon Listener'}</h1><p>@{handle}</p>{profile.bio ? <p>{profile.bio}</p> : null}</div>
    </section>
    <section className={styles.profileBody}>
      <article className={styles.section}><h2>Fan badges</h2>{achievements.length ? <div className={styles.badges}>{achievements.map(item => <span key={item.id}>{item.icon} {item.title}</span>)}</div> : <p className={styles.muted}>Achievements are still being unlocked.</p>}</article>
      {profile.showListeningStats !== false ? <article className={styles.section}><h2>Listening milestones</h2><div className={styles.list}><article><strong>{new Set(recent.map(item => String(item.songId || item.id))).size}</strong><p>Songs explored</p></article><article><strong>{Math.floor(listeningSeconds / 3600)} hours</strong><p>Listening time</p></article><article><strong>{publicPlaylists.length}</strong><p>Public playlists</p></article></div></article> : null}
      <article className={styles.section}><h2>Public playlists</h2>{publicPlaylists.length ? <div className={styles.list}>{publicPlaylists.map(item => <article key={item.id}><strong>{item.name || 'Untitled playlist'}</strong><p>{item.description || `${Array.isArray(item.songIds) ? item.songIds.length : 0} songs`}</p></article>)}</div> : <p className={styles.muted}>No public playlists yet.</p>}</article>
      <article className={styles.section}><h2>Collections</h2>{publicCollections.length ? <div className={styles.list}>{publicCollections.map(item => <article key={item.id}><strong>{item.title}</strong><p>{item.description || 'A personal Aureon collection.'}</p></article>)}</div> : <p className={styles.muted}>No public collections yet.</p>}</article>
      {profile.showFollowing !== false ? <article className={styles.section}><h2>Artists followed</h2>{following.length ? <div className={styles.genres}>{following.map(item => <span key={item.id}>{item.artistName || 'Aureon artist'}</span>)}</div> : <p className={styles.muted}>No public artist follows yet.</p>}</article> : null}
      <article className={styles.section}><h2>Favourite genres</h2>{Array.isArray(profile.favouriteGenres) && profile.favouriteGenres.length ? <div className={styles.genres}>{profile.favouriteGenres.map((genre: string) => <span key={genre}>{genre}</span>)}</div> : <p className={styles.muted}>No genres selected.</p>}</article>
    </section>
  </main>;
}
