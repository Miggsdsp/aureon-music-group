import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function CheckoutCancelledPage() {
  return (
    <main className="page-shell">
      <Header />
      <section className="content-panel" style={{ textAlign: 'center', maxWidth: 850, margin: '80px auto' }}>
        <XCircle size={52} />
        <p className="eyebrow">Payment cancelled</p>
        <h1>Your order has not been charged.</h1>
        <p>Your songs are still in the cart. You can return to checkout or continue browsing Aureon music.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link className="primary-button" href="/checkout">Return to checkout</Link>
          <Link className="ghost-button" href="/music">Browse music</Link>
        </div>
      </section>
      <Footer />
    </main>
  );
}
