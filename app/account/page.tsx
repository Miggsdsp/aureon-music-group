'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import styles from './account.module.css';

type Row = { id: string; [key: string]: any };

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [message, setMessage] = useState('');
  const [member, setMember] = useState<Row | null>(null);
  const [playlists, setPlaylists] = useState<Row[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    setProfileName(current?.displayName || '');
    setLoading(false);
  }), []);

  useEffect(() => {
    if (!user) { setMember(null); setPlaylists([]); return; }
    const unsubMember = onSnapshot(doc(firestore, 'members', user.uid), snap => {
      const next = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      setMember(next);
      if (!profileName && next?.name) setProfileName(String(next.name));
    });
    const unsubPlaylists = onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snap => setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubMember(); unsubPlaylists(); };
  }, [user, profileName]);

  const rawPlan = String(member?.plan || 'free').toLowerCase();
  const status = String(member?.subscriptionStatus || 'inactive').toLowerCase();
  const active = status === 'active' || status === 'trialing';
  const currentPlan = active && rawPlan === 'creator' ? 'creator' : active && rawPlan === 'listener' ? 'listener' : 'free';
  const planLabel = useMemo(() => currentPlan === 'creator' ? 'Aureon Creator' : currentPlan === 'listener' ? 'Aureon Listener' : 'Free account', [currentPlan]);
  const downloadsUsed = Number(member?.monthlyDownloadsUsed || 0);
  const downloadLimit = currentPlan === 'free' ? 0 : 5;

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setBusy('auth');
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
        await setDoc(doc(firestore, 'members', result.user.uid), { name: name.trim(), email: result.user.email || email.trim(), plan: 'free', subscriptionStatus: 'inactive', monthlyDownloadsUsed: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      } else await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Authentication failed.';
      setMessage(raw.includes('invalid-credential') ? 'The email or password is incorrect.' : raw);
    } finally { setBusy(''); }
  }

  async function subscribe(plan: 'listener' | 'creator') {
    if (!user) return; setBusy(plan); setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscriptions/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout.');
      window.location.href = data.url;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start checkout.'); setBusy(''); }
  }

  async function billingPortal() {
    if (!user) return; setBusy('billing'); setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscriptions/portal', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open billing portal.');
      window.location.href = data.url;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open billing portal.'); setBusy(''); }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !profileName.trim()) return;
    setBusy('profile'); setMessage('');
    try {
      await updateProfile(user, { displayName: profileName.trim() });
      await setDoc(doc(firestore, 'members', user.uid), { name: profileName.trim(), email: user.email || '', updatedAt: serverTimestamp() }, { merge: true });
      setMessage('Profile details updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update profile.'); }
    finally { setBusy(''); }
  }

  async function createPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !playlistName.trim()) return;
    await addDoc(collection(firestore, 'members', user.uid, 'playlists'), { name: playlistName.trim(), songIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setPlaylistName('');
  }

  if (loading) return <main className={styles.shell}><section className={styles.hero}><p className={styles.kicker}>Aureon Members</p><h1>Loading your account…</h1></section></main>;

  if (!user) return (
    <main className={styles.shell}>
      <div className={styles.topLinks}><Link href="/membership">← Back to membership</Link><Link href="/">Return home</Link></div>
      <section className={styles.hero}><p className={styles.kicker}>Subscriber access</p><h1>{mode === 'login' ? 'Welcome back.' : 'Join Aureon.'}</h1><p>{mode === 'login' ? 'Sign in to manage your membership, playlists, downloads and billing.' : 'Create your account before choosing your Aureon membership.'}</p></section>
      <div className={styles.authWrap}><section className={styles.panel}><h2>{mode === 'login' ? 'Member login' : 'Create member account'}</h2><p className={styles.subtle}>Your account is your personal Aureon dashboard.</p><form className={styles.form} onSubmit={authenticate}>{mode === 'signup' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label>}<label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>{message && <p className={styles.message}>{message}</p>}<button className={styles.primary} disabled={busy === 'auth'}>{busy === 'auth' ? 'Please wait…' : mode === 'login' ? 'Sign in to dashboard' : 'Create account'}</button><button className={styles.secondary} type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}</button></form></section></div>
    </main>
  );

  return (
    <main className={styles.shell}>
      <div className={styles.topLinks}><Link href="/membership">← Compare plans</Link><Link href="/library">Open member library →</Link></div>
      <section className={styles.hero}><p className={styles.kicker}>Personal member dashboard</p><h1>{user.displayName || 'Welcome back'}</h1><p>{user.email}</p></section>
      {message && <p className={styles.message}>{message}</p>}
      <section className={styles.dashboard}>
        <article className={`${styles.card} ${styles.membership}`}><p className={styles.kicker}>Current membership</p><h2>{planLabel}</h2><span className={styles.status}>{active ? `${status} subscription` : 'No active subscription'}</span><div className={styles.metricRow}><div className={styles.metric}><span>Downloads this month</span><strong>{downloadsUsed} / {downloadLimit}</strong></div><div className={styles.metric}><span>Account access</span><strong>{active ? 'Active' : 'Free'}</strong></div></div><div className={styles.actions}>{currentPlan !== 'listener' && <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('listener')}>{busy === 'listener' ? 'Opening…' : 'Choose Listener €8.99'}</button>}{currentPlan !== 'creator' && <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('creator')}>{busy === 'creator' ? 'Opening…' : currentPlan === 'listener' ? 'Upgrade to Creator €24.99' : 'Choose Creator €24.99'}</button>}{member?.stripeCustomerId && <button className={styles.secondary} disabled={Boolean(busy)} onClick={billingPortal}>{busy === 'billing' ? 'Opening…' : 'Manage billing'}</button>}</div></article>
        <article className={`${styles.card} ${styles.profile}`}><p className={styles.kicker}>Account</p><h2>Member details</h2><form className={styles.form} onSubmit={saveProfile}><label>Full name<input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" /></label><label>Email address<input value={user.email || ''} disabled /></label><button className={styles.secondary} disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile changes'}</button></form></article>
        <article className={`${styles.card} ${styles.playlists}`}><p className={styles.kicker}>Your library</p><h2>Personal playlists</h2><form className={styles.playlistForm} onSubmit={createPlaylist}><label>New playlist<input value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="My Aureon favourites" /></label><button className={styles.secondary}>Create playlist</button></form>{playlists.length ? <ul className={styles.list}>{playlists.map(playlist => <li key={playlist.id}><span><strong>{playlist.name}</strong><small>{Array.isArray(playlist.songIds) ? `${playlist.songIds.length} songs` : '0 songs'}</small></span><button className={styles.danger} onClick={() => deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id))}>Delete</button></li>)}</ul> : <p className={styles.subtle}>No playlists yet. Create one, then choose songs from the member library.</p>}<div className={styles.actions}><Link className={styles.primary} href="/library">Browse songs and add to playlist</Link></div></article>
        <article className={`${styles.card} ${styles.licence}`}><p className={styles.kicker}>Creator licence</p><h2>{currentPlan === 'creator' ? 'Creator access active' : 'Creator access unavailable'}</h2><p className={styles.subtle}>{currentPlan === 'creator' ? 'Commercial licence tools remain available while your Creator subscription is active.' : 'Commercial use, licence certificates and creator downloads require Aureon Creator.'}</p></article>
        <article className={`${styles.card} ${styles.compare}`}><p className={styles.kicker}>Plan access</p><h2>What each plan includes</h2><div className={styles.planGrid}><div><h3>Aureon Listener</h3><p>✓ Full-track streaming</p><p>✓ Personal playlists</p><p>✓ 5 downloads per month</p><p className={styles.notIncluded}>— No commercial-use licence</p><p className={styles.notIncluded}>— No creator licence certificates</p></div><div><h3>Aureon Creator</h3><p>✓ Everything in Listener</p><p>✓ YouTube, podcast and social use</p><p>✓ Defined commercial licence</p><p>✓ Creator licence access</p><p className={styles.notIncluded}>— Rights end when subscription ends</p></div></div></article>
      </section>
      <div className={styles.footerActions}><Link href="/">Return to website</Link><button className={styles.danger} onClick={() => signOut(firebaseAuth)}>Sign out</button></div>
    </main>
  );
}
