'use client';

import { useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
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
  const [message, setMessage] = useState('');
  const [member, setMember] = useState<Row | null>(null);
  const [playlists, setPlaylists] = useState<Row[]>([]);
  const [playlistName, setPlaylistName] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, current => { setUser(current); setLoading(false); }), []);
  useEffect(() => {
    if (!user) { setMember(null); setPlaylists([]); return; }
    const unsubMember = onSnapshot(doc(firestore, 'members', user.uid), snap => setMember(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    const unsubPlaylists = onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snap => setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubMember(); unsubPlaylists(); };
  }, [user]);

  const planLabel = useMemo(() => {
    const plan = String(member?.plan || 'free');
    return plan === 'creator' ? 'Aureon Creator' : plan === 'listener' ? 'Aureon Listener' : 'Free account';
  }, [member]);

  const status = String(member?.subscriptionStatus || 'inactive');
  const active = status === 'active' || status === 'trialing';
  const downloadsUsed = Number(member?.monthlyDownloadsUsed || 0);
  const downloadLimit = member?.plan === 'listener' || member?.plan === 'creator' ? 5 : 0;

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setBusy('auth');
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setBusy('');
    }
  }

  async function subscribe(plan: 'listener' | 'creator') {
    if (!user) return;
    setBusy(plan);
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscriptions/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start checkout.');
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start checkout.');
      setBusy('');
    }
  }

  async function billingPortal() {
    if (!user) return;
    setBusy('billing');
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscriptions/portal', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to open billing portal.');
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to open billing portal.');
      setBusy('');
    }
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
      <section className={styles.hero}>
        <p className={styles.kicker}>Subscriber access</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Join Aureon.'}</h1>
        <p>{mode === 'login' ? 'Sign in to manage your membership, playlists, downloads and billing.' : 'Create your account before choosing your Aureon membership.'}</p>
      </section>
      <div className={styles.authWrap}>
        <section className={styles.panel}>
          <h2>{mode === 'login' ? 'Member login' : 'Create member account'}</h2>
          <p className={styles.subtle}>{mode === 'login' ? 'Use the email and password linked to your Aureon account.' : 'Your account gives you access to your personal subscriber dashboard.'}</p>
          <form className={styles.form} onSubmit={authenticate}>
            {mode === 'signup' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label>}
            <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
            {message && <p className={styles.message}>{message}</p>}
            <button className={styles.primary} disabled={busy === 'auth'}>{busy === 'auth' ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create account'}</button>
            <button className={styles.secondary} type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create a new account' : 'Already have an account? Sign in'}</button>
          </form>
        </section>
      </div>
    </main>
  );

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Personal member dashboard</p>
        <h1>{user.displayName || 'Welcome back'}</h1>
        <p>{user.email}</p>
      </section>
      {message && <p className={styles.message}>{message}</p>}
      <section className={styles.dashboard}>
        <article className={`${styles.card} ${styles.membership}`}>
          <p className={styles.kicker}>Membership</p>
          <h2>{planLabel}</h2>
          <span className={styles.status}>{active ? status : 'No active subscription'}</span>
          <div className={styles.metricRow}>
            <div className={styles.metric}><span>Downloads this month</span><strong>{downloadsUsed} / {downloadLimit}</strong></div>
            <div className={styles.metric}><span>Account access</span><strong>{active ? 'Active' : 'Free'}</strong></div>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('listener')}>{busy === 'listener' ? 'Opening…' : 'Choose Listener €8.99'}</button>
            <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('creator')}>{busy === 'creator' ? 'Opening…' : 'Choose Creator €24.99'}</button>
            {member?.stripeCustomerId && <button className={styles.secondary} disabled={Boolean(busy)} onClick={billingPortal}>{busy === 'billing' ? 'Opening…' : 'Manage billing'}</button>}
          </div>
        </article>

        <article className={`${styles.card} ${styles.profile}`}>
          <p className={styles.kicker}>Account</p>
          <h2>Member details</h2>
          <p className={styles.subtle}><strong>Name:</strong> {user.displayName || 'Not provided'}</p>
          <p className={styles.subtle}><strong>Email:</strong> {user.email}</p>
          <p className={styles.subtle}>Manage payments, invoices and cancellations securely through Stripe Billing.</p>
        </article>

        <article className={`${styles.card} ${styles.playlists}`}>
          <p className={styles.kicker}>Your library</p>
          <h2>Personal playlists</h2>
          <form className={styles.playlistForm} onSubmit={createPlaylist}>
            <label>New playlist<input value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="My Aureon favourites" /></label>
            <button className={styles.secondary}>Create playlist</button>
          </form>
          {playlists.length ? <ul className={styles.list}>{playlists.map(playlist => <li key={playlist.id}><span>{playlist.name}</span><button className={styles.danger} onClick={() => deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id))}>Delete</button></li>)}</ul> : <p className={styles.subtle}>No playlists yet. Create your first playlist above.</p>}
        </article>

        <article className={`${styles.card} ${styles.licence}`}>
          <p className={styles.kicker}>Creator licence</p>
          <h2>{member?.plan === 'creator' && active ? 'Licence active' : 'Creator access'}</h2>
          <p className={styles.subtle}>{member?.plan === 'creator' && active ? 'Your Aureon Creator licence remains active while your Creator subscription is active.' : 'Upgrade to Aureon Creator to license music for YouTube, podcasts, social media and approved commercial use.'}</p>
        </article>
      </section>
      <div className={styles.footerActions}><button className={styles.danger} onClick={() => signOut(firebaseAuth)}>Sign out</button></div>
    </main>
  );
}
