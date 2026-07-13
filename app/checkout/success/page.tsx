'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function CheckoutSuccessPage() {
  useEffect(() => {
    localStorage.removeItem('aureon-cart');
    window.dispatchEvent(new Event('aureon-cart-updated'));
  }, []);

  return (
    <main className="page-shell">
      <Header />
      <section className="content-panel" style={{ textAlign: 'center', maxWidth: 850, margin: '80px auto' }}>
        <CheckCircle2 size={52} />
        <p className="eyebrow">Payment received</p>
        <h1>Thank you for supporting Aureon music.</h1>
        <p>Stripe has accepted your payment. Your order and download access are being prepared. Keep this page open and check the email address used at checkout.</p>
        <Link className="primary-button" href="/music">Return to music</Link>
      </section>
      <Footer />
    </main>
  );
}
