'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';
import './membership.css';

const plans = [
  {
    id: 'listener', name: 'Aureon Listener', price: '€8.99',
    description: 'Unlimited access to the Aureon catalogue, personal playlists and up to five high-quality downloads every billing month.',
    features: ['Full-track premium streaming', 'Create and manage personal playlists', '5 downloads per billing month', 'Access to every published Aureon artist', 'Cancel anytime'],
    exclusions: ['No commercial-use licence', 'No creator licence certificates'],
  },
  {
    id: 'creator', name: 'Aureon Creator', price: '€24.99',
    description: 'Professional music access and licensing for YouTube, podcasts, social media and commercial content within the Aureon licence terms.',
    features: ['Everything included in Listener', 'Creator commercial licence', 'YouTube, podcast and social use', 'High-quality licensed downloads', 'Creator licence access'],
    exclusions: ['Licence rights end when the subscription ends', 'Use remains subject to Aureon licence limits'],
  },
] as const;

export default function MembershipPage() {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  async function subscribe(plan: 'listener' | 'creator') {
    setBusy(plan); setMessage('');
    const current = firebaseAuth.currentUser;
    if (!current) { window.location.href = `/account?plan=${plan}`; return; }
    try {
      const token = await current.getIdToken();
      const response = await fetch('/api/subscriptions/checkout', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ plan }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to start subscription checkout.');
      if (!data.url) throw new Error('Stripe did not return a checkout link.');
      window.location.assign(data.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start subscription checkout.'); setBusy(''); }
  }

  return (
    <main className="membership-page">
      <div className="membership-navigation"><Link href="/">← Back to website</Link><Link href="/account">{user ? 'Open my dashboard' : 'Subscriber login'}</Link></div>
      <section className="membership-hero"><p className="membership-eyebrow">Aureon Membership</p><h1>Listen more.<br />Create more.</h1><p>Choose premium access for personal listening or professional music licensing for your content and business.</p></section>
      {message && <div className="membership-message" role="alert">{message}</div>}
      <section className="membership-grid" aria-label="Membership plans">
        {plans.map(plan => <article className={`membership-card ${plan.id === 'creator' ? 'creator' : ''}`} key={plan.id}><p className="membership-plan">{plan.name}</p><h2>{plan.price}<small> / month</small></h2><p className="membership-description">{plan.description}</p><h3>Included</h3><ul>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul><h3>Not included / limits</h3><ul className="membership-exclusions">{plan.exclusions.map(feature => <li key={feature}>— {feature}</li>)}</ul><button className="primary-button membership-button" disabled={Boolean(busy)} onClick={() => subscribe(plan.id)}>{busy === plan.id ? 'Opening secure checkout…' : user ? `Choose ${plan.name}` : `Log in and choose ${plan.name}`}</button></article>)}
      </section>
      <p className="membership-note">Subscriptions renew monthly until cancelled. Creator licence rights require an active Creator subscription. See the <Link href="/licensing">Digital Download and Licensing terms</Link>.</p>
    </main>
  );
}
