'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { CheckCircle2, PackageCheck, ReceiptText } from 'lucide-react';
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
        <h1>Thank you. Your Aureon order is confirmed.</h1>
        <p>Stripe has accepted your payment and Aureon is completing your order record. A confirmation and receipt will be sent to the email address used at checkout.</p>
        <div style={{ display: 'grid', gap: 14, margin: '28px auto', maxWidth: 650, textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><PackageCheck size={21} /><p style={{ margin: 0 }}><strong>Merchandise:</strong> your delivery address and selected product options have been recorded for fulfilment. Staff can track the order through awaiting fulfilment, processing and shipped.</p></div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}><ReceiptText size={21} /><p style={{ margin: 0 }}><strong>Purchased music:</strong> where your order includes a song, a separate download email contains the secure link to your purchased WAV file. Each link is valid for 72 hours from issue and expires after that time. Each purchased song can be downloaded once only. Please download and save your music before the link expires.</p></div>
        </div>
        <p>Please keep the receipt email as your order confirmation and reference.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <Link className="primary-button" href="/merchandise">Return to merchandise</Link>
          <Link className="primary-button" href="/music">Return to music</Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
