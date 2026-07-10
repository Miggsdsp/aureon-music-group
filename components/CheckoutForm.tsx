'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CreditCard, LockKeyhole, PackageCheck, ShoppingBag } from 'lucide-react';

type CartItem = {
  product: {
    id: string;
    name: string;
    price: number;
    category: string;
    digital?: boolean;
  };
  quantity: number;
  size?: string;
  colour?: string;
};

export function CheckoutForm() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sameAddress, setSameAddress] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('aureon-cart');
    if (!saved) return;
    try { setCart(JSON.parse(saved)); } catch { setCart([]); }
  }, []);

  const hasPhysicalItems = useMemo(() => cart.some(item => !item.product.digital), [cart]);
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    alert('Your order details are ready. Secure payment will be enabled when the payment service is connected.');
  }

  return (
    <section className="checkout-layout">
      <form className="checkout-form" onSubmit={handleSubmit}>
        <div className="checkout-section-heading">
          <LockKeyhole size={22} />
          <div>
            <p className="eyebrow">Customer Details</p>
            <h2>Complete your order</h2>
          </div>
        </div>

        <fieldset>
          <legend>Contact information</legend>
          <div className="checkout-fields two-columns">
            <label>First name<input required name="firstName" autoComplete="given-name" /></label>
            <label>Surname<input required name="surname" autoComplete="family-name" /></label>
          </div>
          <div className="checkout-fields two-columns">
            <label>Email address<input required type="email" name="email" autoComplete="email" /></label>
            <label>Phone number<input required type="tel" name="phone" autoComplete="tel" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Billing address</legend>
          <div className="checkout-fields">
            <label>Address line 1<input required name="billingAddress1" autoComplete="billing address-line1" /></label>
            <label>Address line 2<input name="billingAddress2" autoComplete="billing address-line2" /></label>
          </div>
          <div className="checkout-fields two-columns">
            <label>Town / City<input required name="billingCity" autoComplete="billing address-level2" /></label>
            <label>County / State<input name="billingCounty" autoComplete="billing address-level1" /></label>
          </div>
          <div className="checkout-fields two-columns">
            <label>Country<select required name="billingCountry" defaultValue="IE"><option value="IE">Ireland</option><option value="PT">Portugal</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="ZA">South Africa</option><option value="OTHER">Other</option></select></label>
            <label>Postcode / Eircode<input required name="billingPostcode" autoComplete="billing postal-code" /></label>
          </div>
        </fieldset>

        {hasPhysicalItems && (
          <fieldset>
            <legend>Delivery address</legend>
            <label className="checkout-checkbox"><input type="checkbox" checked={sameAddress} onChange={event => setSameAddress(event.target.checked)} /> Same as billing address</label>
            {!sameAddress && (
              <div className="checkout-fields">
                <label>Recipient name<input required name="shippingName" autoComplete="shipping name" /></label>
                <label>Delivery address<input required name="shippingAddress" autoComplete="shipping street-address" /></label>
                <div className="checkout-fields two-columns">
                  <label>Town / City<input required name="shippingCity" autoComplete="shipping address-level2" /></label>
                  <label>Postcode / Eircode<input required name="shippingPostcode" autoComplete="shipping postal-code" /></label>
                </div>
              </div>
            )}
            <label>Delivery instructions<textarea name="deliveryInstructions" rows={3} /></label>
          </fieldset>
        )}

        <fieldset>
          <legend>Order notes</legend>
          <label>Optional notes<textarea name="orderNotes" rows={4} /></label>
        </fieldset>

        <label className="checkout-checkbox"><input required type="checkbox" /> I agree to the Terms, Privacy Policy and applicable Digital Download Policy.</label>
        <label className="checkout-checkbox"><input type="checkbox" /> Email me about future Aureon releases and offers.</label>

        <button className="checkout-submit" type="submit"><CreditCard size={18} /> Continue to secure payment</button>
        <p className="checkout-security-note">Payment is not yet active. No card details are collected on this page.</p>
      </form>

      <aside className="checkout-summary-card">
        <div className="checkout-section-heading compact">
          <ShoppingBag size={21} />
          <div><p className="eyebrow">Your Order</p><h2>Order summary</h2></div>
        </div>
        {cart.length === 0 ? (
          <div className="checkout-empty"><ShoppingBag /><p>Your cart is empty.</p><Link href="/merchandise">Browse the store →</Link></div>
        ) : (
          <div className="checkout-order-items">
            {cart.map(item => (
              <article key={`${item.product.id}-${item.size || ''}-${item.colour || ''}`}>
                <div><strong>{item.product.name}</strong><span>{item.quantity} × €{item.product.price.toFixed(2)}</span></div>
                <b>€{(item.product.price * item.quantity).toFixed(2)}</b>
              </article>
            ))}
          </div>
        )}
        <div className="checkout-totals"><span>Subtotal</span><strong>€{subtotal.toFixed(2)}</strong></div>
        <div className="checkout-delivery-note"><PackageCheck size={18} /><p>{hasPhysicalItems ? 'Shipping and applicable taxes will be calculated before payment.' : 'Digital purchases will be delivered to your email after verified payment.'}</p></div>
      </aside>
    </section>
  );
}
