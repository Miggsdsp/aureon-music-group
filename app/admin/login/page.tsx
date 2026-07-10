'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { LockKeyhole, Mail } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

export default function AdminLoginPage() {
  const router = useRouter();
  const { authorised, loading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && authorised) router.replace('/admin');
  }, [authorised, loading, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      router.replace('/admin');
    } catch {
      setMessage('Login failed. Check your email, password and admin access.');
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
      setMessage('Password reset email sent.');
    } catch {
      setMessage('Unable to send the reset email.');
    }
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
          {message && <p className="admin-form-message">{message}</p>}
          <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
          <button type="button" className="admin-text-button" onClick={resetPassword}>Forgot password?</button>
        </form>
      </section>
    </main>
  );
}
