'use client';

import Link from 'next/link';
import { useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';

const plans = [
  {
    id: 'listener',
    name: 'Aureon Listener',
    price: '€8.99',
    description: 'Unlimited listening to the Aureon catalogue, custom playlists and up to five member downloads each month.',
    features: ['Full-track streaming', 'Create personal playlists', '5 downloads per billing month', 'Access while membership is active'],
  },
  {
    id: 'creator',
    name: 'Aureon Creator',
    price: '€24.99',
    description: 'Commercial music access for creators, podcasts, YouTube and social content within the Aureon licence limits.',
    features: ['Everything in Listener', 'Creator commercial licence', 'YouTube, podcast and social use', 'Licences remain valid only while subscription is active'],
  },
] as const;

export default function MembershipPage() {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function subscribe(plan: 'listener' | 'creator') {
    setBusy(plan);
    setMessage('');
    const user = firebaseAuth.currentUser;
    if (!user) {
      window.location.href = `/account?plan=${plan}`;
      return;
    }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start subscription.');
      window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start subscription.');
      setBusy('');
    }
  }

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero">
        <p className="section-kicker">Aureon Membership</p>
        <h1>Listen more. Create more.</h1>
        <p>Choose a premium membership built for music lovers or professional content creators.</p>
      </section>
      {message && <p className="form-message">{message}</p>}
      <section className="membership-grid">
        {plans.map(plan => (
          <article className="membership-card" key={plan.id}>
            <p className="section-kicker">{plan.name}</p>
            <h2>{plan.price}<small> / month</small></h2>
            <p>{plan.description}</p>
            <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            <button className="primary-button" disabled={Boolean(busy)} onClick={() => subscribe(plan.id)}>
              {busy === plan.id ? 'Opening secure checkout…' : `Choose ${plan.name}`}
            </button>
          </article>
        ))}
      </section>
      <p className="membership-note">Subscriptions renew monthly until cancelled. Creator licences end when the Creator subscription is no longer active. See the <Link href="/licensing">Digital Download and Licensing terms</Link>.</p>
    </main>
  );
}
