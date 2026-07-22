'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import styles from './account.module.css';

type Row = { id: string; [key: string]: any };
type Plan = 'free' | 'listener' | 'creator';

function timestampDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate() as Date;
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function friendlyStatus(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd && (status === 'active' || status === 'trialing')) return 'Active — cancels at period end';
  if (status === 'trialing') return 'Trial active';
  if (status === 'active') return 'Active';
  if (status === 'past_due') return 'Payment overdue';
  if (status === 'unpaid') return 'Payment required';
  if (status === 'canceled') return 'Cancelled';
  if (status === 'incomplete') return 'Payment incomplete';
  return 'No active subscription';
}

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

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('subscription') !== 'success' || !sessionId) {
      if (params.get('plan') === 'changed') {
        setMessage('Your Aureon membership plan has been updated.');
        window.history.replaceState({}, '', '/account');
      }
      return;
    }

    let cancelled = false;
    async function confirmSubscription() {
      setBusy('confirming');
      setMessage('Confirming your Aureon membership…');
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/subscriptions/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to confirm subscription.');
        if (!cancelled) {
          setMessage(`Your ${data.plan === 'creator' ? 'Aureon Creator' : 'Aureon Listener'} membership is now active.`);
          window.history.replaceState({}, '', '/account');
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to confirm subscription.');
      } finally {
        if (!cancelled) setBusy('');
      }
    }
    confirmSubscription();
    return () => { cancelled = true; };
  }, [user]);

  const rawPlan = String(member?.plan || 'free').toLowerCase() as Plan;
  const status = String(member?.subscriptionStatus || 'inactive').toLowerCase();
  const active = status === 'active' || status === 'trialing';
  const currentPlan: Plan = rawPlan === 'creator' || rawPlan === 'listener' ? rawPlan : 'free';
  const planLabel = useMemo(() => currentPlan === 'creator' ? 'Aureon Creator' : currentPlan === 'listener' ? 'Aureon Listener' : 'Free account', [currentPlan]);
  const downloadsUsed = Number(member?.monthlyDownloadsUsed || 0);
  const downloadLimit = active ? Number(member?.monthlyDownloadLimit || 5) : 0;
  const renewalDate = timestampDate(member?.currentPeriodEnd);
  const cancelAtPeriodEnd = Boolean(member?.cancelAtPeriodEnd);

  async function authenticate(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setBusy('auth');
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (name.trim()) await updateProfile(result.user, { displayName: name.trim() });
        await setDoc(doc(firestore, 'members', result.user.uid), { name: name.trim(), email: result.user.email || email.trim(), plan: 'free', subscriptionStatus: 'inactive', monthlyDownloadsUsed: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        await sendEmailVerification(result.user, { url: `${window.location.origin}/account` });
        setMessage('Account created. We sent a verification link to your email address.');
      } else {
        const result = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (!result.user.emailVerified) setMessage('Signed in. Please verify your email before subscribing.');
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Authentication failed.';
      setMessage(raw.includes('invalid-credential') ? 'The email or password is incorrect.' : raw);
    } finally { setBusy(''); }
  }

  async function resetPassword() {
    if (!email.trim()) { setMessage('Enter your email address first, then select Reset password.'); return; }
    setBusy('reset'); setMessage('');
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim(), { url: `${window.location.origin}/account` });
      setMessage('Password reset email sent. Check your inbox and spam folder.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send password reset email.'); }
    finally { setBusy(''); }
  }

  async function resendVerification() {
    if (!user) return;
    setBusy('verify'); setMessage('');
    try {
      await sendEmailVerification(user, { url: `${window.location.origin}/account` });
      setMessage('Verification email sent. Check your inbox and spam folder.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send verification email.'); }
    finally { setBusy(''); }
  }

  async function refreshVerification() {
    if (!user) return;
    setBusy('refresh-verify');
    await reload(user);
    setUser(firebaseAuth.currentUser);
    setMessage(firebaseAuth.currentUser?.emailVerified ? 'Email address verified.' : 'Email is not verified yet. Open the link in your email, then try again.');
    setBusy('');
  }

  async function subscribe(plan: 'listener' | 'creator') {
    if (!user) return;
    if (!user.emailVerified) { setMessage('Verify your email address before starting a paid membership.'); return; }
    setBusy(plan); setMessage('');
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
      <div className={styles.authWrap}><section className={styles.panel}><h2>{mode === 'login' ? 'Member login' : 'Create member account'}</h2><p className={styles.subtle}>Your account is your personal Aureon dashboard.</p><form className={styles.form} onSubmit={authenticate}>{mode === 'signup' && <label>Full name<input value={name} onChange={e => setName(e.target.value)} required /></label>}<label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>{message && <p className={styles.message}>{message}</p>}<button className={styles.primary} disabled={busy === 'auth'}>{busy === 'auth' ? 'Please wait…' : mode === 'login' ? 'Sign in to dashboard' : 'Create account'}</button>{mode === 'login' && <button className={styles.secondary} type="button" disabled={busy === 'reset'} onClick={resetPassword}>{busy === 'reset' ? 'Sending…' : 'Reset password'}</button>}<button className={styles.secondary} type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}</button></form></section></div>
    </main>
  );

  return (
    <main className={styles.shell}>
      <div className={styles.topLinks}><Link href="/membership">← Compare plans</Link><Link href="/library">Open member library →</Link></div>
      <section className={styles.hero}><p className={styles.kicker}>Personal member dashboard</p><h1>{user.displayName || 'Welcome back'}</h1><p>{user.email}</p></section>
      {message && <p className={styles.message}>{message}</p>}
      {!user.emailVerified && <section className={styles.message}><strong>Email verification required.</strong> Verify your email before subscribing. <button className={styles.secondary} disabled={Boolean(busy)} onClick={resendVerification}>Resend verification</button> <button className={styles.secondary} disabled={Boolean(busy)} onClick={refreshVerification}>I have verified</button></section>}
      <section className={styles.dashboard}>
        <article className={`${styles.card} ${styles.membership}`}><p className={styles.kicker}>Current membership</p><h2>{busy === 'confirming' ? 'Confirming membership…' : planLabel}</h2><span className={styles.status}>{friendlyStatus(status, cancelAtPeriodEnd)}</span><div className={styles.metricRow}><div className={styles.metric}><span>Downloads this month</span><strong>{downloadsUsed} / {downloadLimit}</strong></div><div className={styles.metric}><span>{cancelAtPeriodEnd ? 'Access ends' : 'Next renewal'}</span><strong>{renewalDate ? renewalDate.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</strong></div></div>{status === 'past_due' || status === 'unpaid' ? <p className={styles.message}>Payment requires attention. Open Manage billing to update your payment method.</p> : null}<div className={styles.actions}>{currentPlan !== 'listener' && <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('listener')}>{busy === 'listener' ? 'Updating…' : active ? 'Downgrade to Listener €8.99' : 'Choose Listener €8.99'}</button>}{currentPlan !== 'creator' && <button className={styles.primary} disabled={Boolean(busy)} onClick={() => subscribe('creator')}>{busy === 'creator' ? 'Updating…' : active ? 'Upgrade to Creator €24.99' : 'Choose Creator €24.99'}</button>}{member?.stripeCustomerId && <button className={styles.secondary} disabled={Boolean(busy)} onClick={billingPortal}>{busy === 'billing' ? 'Opening…' : 'Manage billing'}</button>}</div></article>
        <article className={`${styles.card} ${styles.profile}`}><p className={styles.kicker}>Account</p><h2>Member details</h2><form className={styles.form} onSubmit={saveProfile}><label>Full name<input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" /></label><label>Email address<input value={user.email || ''} disabled /></label><label>Email status<input value={user.emailVerified ? 'Verified' : 'Not verified'} disabled /></label><button className={styles.secondary} disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile changes'}</button></form></article>
        <article className={`${styles.card} ${styles.playlists}`}><p className={styles.kicker}>Your library</p><h2>Personal playlists</h2><form className={styles.playlistForm} onSubmit={createPlaylist}><label>New playlist<input value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="My Aureon favourites" /></label><button className={styles.secondary}>Create playlist</button></form>{playlists.length ? <ul className={styles.list}>{playlists.map(playlist => <li key={playlist.id}><span><strong>{playlist.name}</strong><small>{Array.isArray(playlist.songIds) ? `${playlist.songIds.length} songs` : '0 songs'}</small></span><button className={styles.danger} onClick={() => deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id))}>Delete</button></li>)}</ul> : <p className={styles.subtle}>No playlists yet. Create one, then choose songs from the member library.</p>}<div className={styles.actions}><Link className={styles.primary} href="/library">Browse songs and add to playlist</Link></div></article>
        <article className={`${styles.card} ${styles.licence}`}><p className={styles.kicker}>Creator licence</p><h2>{currentPlan === 'creator' && active ? 'Creator access active' : 'Creator access unavailable'}</h2><p className={styles.subtle}>{currentPlan === 'creator' && active ? 'Commercial licence tools remain available while your Creator subscription is active.' : 'Commercial use, licence certificates and creator downloads require an active Aureon Creator subscription.'}</p></article>
        <article className={`${styles.card} ${styles.compare}`}><p className={styles.kicker}>Plan access</p><h2>What each plan includes</h2><div className={styles.planGrid}><div><h3>Aureon Listener</h3><p>✓ Full-track streaming</p><p>✓ Personal playlists</p><p>✓ 5 downloads per month</p><p className={styles.notIncluded}>— No commercial-use licence</p><p className={styles.notIncluded}>— No creator licence certificates</p></div><div><h3>Aureon Creator</h3><p>✓ Everything in Listener</p><p>✓ YouTube, podcast and social use</p><p>✓ Defined commercial licence</p><p>✓ Creator licence access</p><p className={styles.notIncluded}>— Rights end when subscription ends</p></div></div></article>
      </section>
      <div className={styles.footerActions}><Link href="/">Return to website</Link><button className={styles.danger} onClick={() => signOut(firebaseAuth)}>Sign out</button></div>
    </main>
  );
}
