import Link from 'next/link';
import { CreditCard, LockKeyhole } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

export default function CheckoutPage(){
 return <PageShell title="Checkout" kicker="Secure Order">
  <section className="checkout-placeholder"><LockKeyhole/><h2>Checkout integration ready</h2><p>The storefront and cart are live. The final payment step will connect to Stripe or Shopify once the merchant account, shipping rules and tax settings are confirmed.</p><div><CreditCard/>Secure card payments, Apple Pay and Google Pay can be connected here.</div><Link href="/merchandise" className="primary-button">Return to store</Link></section>
 </PageShell>
}
