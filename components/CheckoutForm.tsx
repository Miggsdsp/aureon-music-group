'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CreditCard, LockKeyhole, Music2, ShoppingBag, Trash2 } from 'lucide-react';

type CartItem = {
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
    artist?: string;
    digital?: boolean;
  };
  quantity: number;
};

function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'Tablet';
  if (/iphone|android.+mobile|mobile/.test(ua)) return 'Mobile';
  return 'Desktop';
}

function trafficSource() {
  const params = new URLSearchParams(window.location.search);
  const utm = params.get('utm_source');
  if (utm) return utm;
  if (!document.referrer) return 'Direct';
  try {
    const referrer = new URL(document.referrer);
    if (referrer.hostname === window.location.hostname) return 'Internal navigation';
    return referrer.hostname.replace(/^www\./, '');
  } catch {
    return 'Referral';
  }
}

export function CheckoutForm() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('aureon-cart');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as CartItem[];
      setCart(parsed.filter(item => item.product?.digital === true).map(item => ({ ...item, quantity: 1 })));
    } catch {
      setCart([]);
    }
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price, 0), [cart]);

  function removeItem(id: string) {
    const next = cart.filter(item => item.product.id !== id);
    setCart(next);
    localStorage.setItem('aureon-cart', JSON.stringify(next));
    window.dispatchEvent(new Event('aureon-cart-updated'));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!cart.length) {
      setError('Your cart is empty. Add a song before continuing.');
      return;
    }

    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);
    setSubmitting(true);

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.get('firstName'),
          surname: form.get('surname'),
          email: form.get('email'),
          phone: form.get('phone'),
          deviceType: detectDevice(),
          trafficSource: trafficSource(),
          utmSource: params.get('utm_source') || '',
          utmMedium: params.get('utm_medium') || '',
          utmCampaign: params.get('utm_campaign') || '',
          landingPath: sessionStorage.getItem('aureon-landing-path') || window.location.pathname,
          items: cart.map(item => ({
            id: item.product.id,
            name: item.product.name,
            artist: item.product.artist,
            quantity: 1,
            digital: true,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start payment.');
      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Unable to start payment.');
      setSubmitting(false);
    }
  }

  return (
    <section className="checkout-layout">
      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="checkout-section-heading">
          <LockKeyhole size={22} />
          <div><p className="eyebrow">Customer Details</p><h2>Complete your music order</h2></div>
        </div>

        <fieldset>
          <legend>Contact information</legend>
          <div className="checkout-fields two-columns">
            <label>First name<input required name="firstName" autoComplete="given-name" /></label>
            <label>Surname<input required name="surname" autoComplete="family-name" /></label>
          </div>
          <div className="checkout-fields two-columns">
            <label>Email address<input required type="email" name="email" autoComplete="email" /></label>
            <label>Phone number<input type="tel" name="phone" autoComplete="tel" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Digital delivery</legend>
          <p>Your secure download access will be created after Stripe confirms payment. Use an email address you can access.</p>
        </fieldset>

        <label className="checkout-checkbox"><input required type="checkbox" /> I agree to the <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/digital-download-policy">Digital Download Policy</Link>.</label>
        <label className="checkout-checkbox"><input type="checkbox" name="marketingConsent" /> Email me about future Aureon releases and offers.</label>

        {error && <div className="admin-cms-message" role="alert">{error}</div>}
        <button className="checkout-submit" type="submit" disabled={submitting || cart.length === 0}><CreditCard size={18} /> {submitting ? 'Opening secure payment…' : 'Pay securely with Stripe'}</button>
        <p className="checkout-security-note">Card details are entered securely on Stripe and are never stored by Aureon Music Group.</p>
      </form>

      <aside className="checkout-summary-card">
        <div className="checkout-section-heading compact">
          <ShoppingBag size={21} />
          <div><p className="eyebrow">Your Order</p><h2>Music downloads</h2></div>
        </div>
        {cart.length === 0 ? (
          <div className="checkout-empty"><Music2 /><p>Your music cart is empty.</p><Link href="/music">Browse music →</Link></div>
        ) : (
          <div className="checkout-order-items">
            {cart.map(item => (
              <article key={item.product.id}>
                <div><strong>{item.product.name}</strong><span>Digital download · €{item.product.price.toFixed(2)}</span></div>
                <button type="button" onClick={() => removeItem(item.product.id)} aria-label={`Remove ${item.product.name}`}><Trash2 size={16} /></button>
              </article>
            ))}
          </div>
        )}
        <div className="checkout-totals"><span>Total</span><strong>€{subtotal.toFixed(2)}</strong></div>
        <p><Link href="/music">← Continue browsing music</Link></p>
      </aside>
    </section>
  );
}
