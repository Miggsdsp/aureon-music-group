'use client';

import Link from 'next/link';
import { useState } from 'react';
import { firebaseAuth } from '@/lib/firebase-client';
import './membership.css';

const plans = [
  {
    id: 'listener',
    name: 'Aureon Listener',
    price: '€8.99',
    description: 'Unlimited access to the Aureon catalogue, personal playlists and up to five high-quality downloads every billing month.',
    features: ['Full-track premium streaming', 'Create and manage personal playlists', '5 downloads per billing month', 'Access to every published Aureon artist', 'Cancel anytime'],
  },
  {
    id: 'creator',
    name: 'Aureon Creator',
    price: '€24.99',
    description: 'Professional music access and licensing for YouTube, podcasts, social media and commercial content within the Aureon licence terms.',
    features: ['Everything included in Listener', 'Creator commercial licence', 'YouTube, podcast and social use', 'High-quality licensed downloads', 'Rights remain active while subscribed'],
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
      if (!response.ok) throw new Error(data.error || 'Unable to start subscription checkout.');
      if (!data.url) throw new Error('Stripe did not return a checkout link.');
      window.location.assign(data.url);
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unable to start subscription checkout.';
      setMessage(raw.includes('Stripe price is not configured')
        ? 'Subscription pricing is not connected on this environment. Add the Stripe price IDs to .env.local for localhost, restart the server, and try again.'
        : raw);
      setBusy('');
    }
  }

  return (
    <main className="membership-page">
      <section className="membership-hero">
        <p className="membership-eyebrow">Aureon Membership</p>
        <h1>Listen more.<br />Create more.</h1>
        <p>Choose premium access for personal listening or professional music licensing for your content and business.</p>
      </section>

      {message && <div className="membership-message" role="alert">{message}</div>}

      <section className="membership-grid" aria-label="Membership plans">
        {plans.map(plan => (
          <article className={`membership-card ${plan.id === 'creator' ? 'creator' : ''}`} key={plan.id}>
            <p className="membership-plan">{plan.name}</p>
            <h2>{plan.price}<small> / month</small></h2>
            <p className="membership-description">{plan.description}</p>
            <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
            <button className="primary-button membership-button" disabled={Boolean(busy)} onClick={() => subscribe(plan.id)}>
              {busy === plan.id ? 'Opening secure checkout…' : `Choose ${plan.name}`}
            </button>
          </article>
        ))}
      </section>

      <p className="membership-note">Subscriptions renew monthly until cancelled. Creator licence rights require an active Creator subscription. See the <Link href="/licensing">Digital Download and Licensing terms</Link>.</p>
    </main>
  );
}
