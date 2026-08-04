import Link from 'next/link';
import { adminFirestore } from '@/lib/firebase-admin';
import styles from './community.module.css';

export const dynamic = 'force-dynamic';

type Row = { id: string; [key: string]: any };
function dateValue(value: any) { if (!value) return 0; if (typeof value.toMillis === 'function') return value.toMillis(); if (typeof value.toDate === 'function') return value.toDate().getTime(); if (typeof value.seconds === 'number') return value.seconds * 1000; const date = new Date(value); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); }

export default async function CommunityPage() {
  const [profilesSnapshot, activitySnapshot] = await Promise.all([
    adminFirestore.collection('communityProfiles').where('public', '==', true).limit(24).get(),
    adminFirestore.collection('communityActivities').where('public', '==', true).limit(50).get(),
  ]);
  const profiles: Row[] = profilesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt));
  const activities: Row[] = activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt)).slice(0, 20);

  return <main className={styles.page}>
    <section className={styles.hero}>
      <p className={styles.kicker}>Aureon Community</p>
      <h1>Music connects us.</h1>
      <p>Discover listeners, public playlists, achievements and the stories forming around Aureon artists and releases.</p>
    </section>

    <section className={styles.grid} aria-label="Community profiles">
      {profiles.length ? profiles.map(profile => <article className={styles.card} key={profile.id}>
        {profile.avatarUrl ? <img src={String(profile.avatarUrl)} alt="" /> : <div className={styles.avatar} />}
        <div><p className={styles.kicker}>Aureon listener</p><h2>{profile.displayName || 'Aureon Listener'}</h2><p>@{profile.handle}</p></div>
        {profile.bio ? <p>{profile.bio}</p> : null}
        {Array.isArray(profile.favouriteGenres) && profile.favouriteGenres.length ? <div className={styles.genres}>{profile.favouriteGenres.map((genre: string) => <span key={genre}>{genre}</span>)}</div> : null}
        <Link href={`/community/${profile.handle}`}>View profile →</Link>
      </article>) : <article className={styles.card}><h2>The community is opening.</h2><p>Members can publish their profile from the Account dashboard.</p><Link href="/account">Create your profile →</Link></article>}
    </section>

    <section className={styles.feed}>
      <p className={styles.kicker}>Activity feed</p><h2>What the community is sharing</h2>
      {activities.length ? activities.map(activity => <article className={styles.activity} key={activity.id}><div className={styles.activityIcon}>♪</div><div><strong>{activity.displayName || 'Aureon Listener'}</strong><p>{activity.title}</p>{activity.description ? <small>{activity.description}</small> : null}</div>{activity.href ? <Link href={String(activity.href)}>Explore →</Link> : null}</article>) : <p className={styles.muted}>Public playlists and collections will appear here as members begin sharing.</p>}
    </section>
  </main>;
}
