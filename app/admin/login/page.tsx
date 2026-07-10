'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { LockKeyhole, Mail } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

function friendlyAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) return 'Login failed. Please try again.';

  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'The email address or password is incorrect.';
    case 'auth/user-not-found':
      return 'No Firebase Authentication user exists for this email address.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This Firebase Authentication account has been disabled.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a few minutes or reset the password.';
    case 'auth/network-request-failed':
      return 'The browser could not reach Firebase. Check your internet connection.';
    default:
      return `Firebase login error: ${error.code}`;
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { authorised, loading, accessError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && authorised) router.replace('/admin');
    if (!loading && accessError) setMessage(accessError);
  }, [authorised, loading, accessError, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch (error) {
      setMessage(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setMessage('Enter your email address first.');
      return;
    }
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setMessage('Password reset email sent. Check your inbox and junk folder.');
    } catch (error) {
      setMessage(friendlyAuthError(error));
    }
  }

  async function clearSession() {
    await signOut(firebaseAuth);
    setMessage('Session cleared. Sign in with an authorised account.');
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <p className="admin-kicker">Aureon Control Center</p>
        <h1>Secure Admin Login</h1>
        <p>Authorised Aureon Music Group staff only.</p>
        <form onSubmit={submit}>
          <label><Mail size={17} /> Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label><LockKeyhole size={17} /> Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
          {message && <p className="admin-form-message" role="status">{message}</p>}
          <button type="submit" disabled={busy || loading}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
          <button type="button" className="admin-text-button" onClick={resetPassword}>Forgot password?</button>
          {accessError && <button type="button" className="admin-text-button" onClick={clearSession}>Use another account</button>}
        </form>
      </section>
    </main>
  );
}
