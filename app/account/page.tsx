'use client';

import { useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';

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

  async function authenticate(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    }
  }

  async function subscribe(plan: 'listener' | 'creator') {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch('/api/subscriptions/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) });
    const data = await response.json();
    if (response.ok) window.location.href = data.url; else setMessage(data.error || 'Unable to start checkout.');
  }

  async function billingPortal() {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch('/api/subscriptions/portal', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (response.ok) window.location.href = data.url; else setMessage(data.error || 'Unable to open billing portal.');
  }

  async function createPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !playlistName.trim()) return;
    await addDoc(collection(firestore, 'members', user.uid, 'playlists'), { name: playlistName.trim(), songIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setPlaylistName('');
  }

  if (loading) return <main className="page-shell"><p>Loading account…</p></main>;

  if (!user) return (
    <main className="page-shell">
      <section className="page-hero compact-hero"><p className="section-kicker">Aureon Members</p><h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1></section>
      <form className="member-auth-form" onSubmit={authenticate}>
        {mode === 'signup' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label>}
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary-button">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create a new account' : 'Already have an account?'}</button>
      </form>
    </main>
  );

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero"><p className="section-kicker">Member workspace</p><h1>{user.displayName || user.email}</h1><p>{planLabel}</p></section>
      {message && <p className="form-message">{message}</p>}
      <section className="member-dashboard-grid">
        <article><h2>Membership</h2><p>Status: {member?.subscriptionStatus || 'No active subscription'}</p><p>Downloads used this month: {Number(member?.monthlyDownloadsUsed || 0)} / {member?.plan === 'listener' || member?.plan === 'creator' ? 5 : 0}</p><div className="member-actions"><button onClick={() => subscribe('listener')}>Listener €8.99</button><button onClick={() => subscribe('creator')}>Creator €24.99</button>{member?.stripeCustomerId && <button onClick={billingPortal}>Manage billing</button>}</div></article>
        <article><h2>Your playlists</h2><form onSubmit={createPlaylist}><label>New playlist<input value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="My Aureon favourites" /></label><button>Create playlist</button></form>{playlists.length ? <ul>{playlists.map(playlist => <li key={playlist.id}><span>{playlist.name}</span><button onClick={() => deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id))}>Delete</button></li>)}</ul> : <p>No playlists yet.</p>}</article>
        <article><h2>Creator licence</h2><p>{member?.plan === 'creator' && ['active', 'trialing'].includes(String(member?.subscriptionStatus)) ? 'Your creator licence is active while your subscription remains active.' : 'Upgrade to Aureon Creator to license music for YouTube, podcasts, social media and defined commercial use.'}</p></article>
      </section>
      <button onClick={() => signOut(firebaseAuth)}>Sign out</button>
    </main>
  );
}
