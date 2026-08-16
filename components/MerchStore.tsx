'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { products as fallbackProducts, type Product } from '@/data/products';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { trackAnalytics } from '@/lib/track-analytics';
import { availableQuantity, isSoldOut, normaliseColours, normaliseSizes } from '@/lib/merch-inventory';

type ProductRecord = PublicRecord & Partial<Product> & { name: string; slug: string; price: number; imageUrl?: string };
type CartItem = { product: Product; quantity: number; size?: string; colour?: string };
type Member = { plan?: string; subscriptionStatus?: string; subscriptionActive?: boolean };
const cartKey = (item: Pick<CartItem, 'product'|'size'|'colour'>) => `${item.product.id}::${item.size || ''}::${item.colour || ''}`;

export function MerchStore() {
  const { items: records } = usePublishedCollection<ProductRecord>('products', fallbackProducts.map(product => ({ ...product, id: product.id } as ProductRecord)));
  const products = records.map(item => ({ ...item, image: item.imageUrl || item.image || '/images/branding/Aureon_Header_Logo.png', sizes: normaliseSizes(item.sizes), colours: normaliseColours(item.colours), digital: false } as Product));
  const categories = ['All', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))] as string[];
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => { if (!user) { setMember(null); return; } return onSnapshot(doc(firestore, 'members', user.uid), snap => setMember(snap.exists() ? snap.data() as Member : null)); }, [user]);
  useEffect(() => { const saved = localStorage.getItem('aureon-cart'); if (saved) { try { setCart(JSON.parse(saved)); } catch {} } }, []);
  useEffect(() => { localStorage.setItem('aureon-cart', JSON.stringify(cart)); window.dispatchEvent(new Event('aureon-cart-updated')); }, [cart]);

  const active = ['active','trialing'].includes(String(member?.subscriptionStatus || '').toLowerCase()) && member?.subscriptionActive === true;
  const discountPercent = active ? (String(member?.plan || '').toLowerCase() === 'creator' ? 20 : 10) : 0;
  const discountedPrice = (price: number) => Number((price * (100 - discountPercent) / 100).toFixed(2));
  const filtered = useMemo(() => {
    let list = products.filter(product => (category === 'All' || product.category === category) && (`${product.name} ${product.artist || ''}`.toLowerCase().includes(query.toLowerCase())));
    if (sort === 'low') list = [...list].sort((a,b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a,b) => b.price - a.price);
    if (sort === 'name') list = [...list].sort((a,b) => a.name.localeCompare(b.name));
    return list;
  }, [products, category, query, sort]);

  useEffect(() => { filtered.slice(0,24).forEach(product => trackAnalytics({ eventType:'merch_view', entityType:'product', entityId:product.id, productId:product.id, productName:product.name, artistName:product.artist || '' })); }, [category, query, sort, records.length]);

  const itemCount = cart.reduce((sum,item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum,item) => sum + discountedPrice(item.product.price) * item.quantity, 0);

  function addSimpleProduct(product: Product) {
    if (isSoldOut(product)) return;
    const nextItem: CartItem = { product: { ...product, digital:false }, quantity:1 };
    setCart(current => {
      const key = cartKey(nextItem);
      const existing = current.find(item => cartKey(item) === key);
      const max = availableQuantity(product);
      if (existing) return current.map(item => cartKey(item) === key ? { ...item, quantity: Math.min(Number.isFinite(max) ? max : 10, item.quantity + 1) } : item);
      return [...current, nextItem];
    });
    setCartOpen(true);
    trackAnalytics({ eventType:'merch_cart_add', entityType:'product', entityId:product.id, productId:product.id, productName:product.name, artistName:product.artist || '' });
  }

  function changeQuantity(key: string, delta: number) {
    setCart(current => current.map(item => {
      if (cartKey(item) !== key) return item;
      const max = Math.min(10, availableQuantity(item.product, item.size));
      return { ...item, quantity: Math.max(0, Math.min(Number.isFinite(max) ? max : 10, item.quantity + delta)) };
    }).filter(item => item.quantity > 0));
  }

  return <>
    {discountPercent > 0 && <div className="member-merch-discount"><strong>{discountPercent}% member discount active</strong><span>Your discounted prices are shown below and will be verified again at secure checkout.</span></div>}
    <section className="store-toolbar"><div className="store-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products or artists"/></div><div className="store-sort"><SlidersHorizontal size={17}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option></select></div><button className="cart-button" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/>Cart <span>{itemCount}</span></button></section>
    <nav className="store-categories" aria-label="Merchandise categories">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</nav>
    <section className="product-grid">{filtered.map(product => {
      const memberPrice = discountedPrice(product.price);
      const soldOut = isSoldOut(product);
      const hasOptions = Boolean(product.sizes?.length || product.colours?.length);
      return <article className="product-card" key={product.id}>
        <Link href={`/merchandise/${product.slug}`} className="product-image-wrap" style={{position:'relative'}}>
          {soldOut && <span style={{position:'absolute',left:0,right:0,top:'44%',zIndex:5,background:'#b00020',color:'#fff',padding:'10px 8px',fontWeight:800,textAlign:'center',letterSpacing:'.12em'}}>SOLD OUT</span>}
          {!soldOut && product.badge && <span className="product-badge">{product.badge}</span>}
          <Image src={product.image} alt={product.name} width={800} height={800} unoptimized className="product-image"/>
        </Link>
        <div className="product-card-copy"><p>{product.artist}</p><Link href={`/merchandise/${product.slug}`}><h3>{product.name}</h3></Link><div className="product-price">{discountPercent>0&&<del>€{Number(product.price).toFixed(2)}</del>} €{memberPrice.toFixed(2)} {discountPercent>0&&<small>Member price</small>}</div><div className="product-actions"><Link href={`/merchandise/${product.slug}`} className="product-view">{hasOptions ? 'Select options' : 'View product'}</Link>{!hasOptions && <button disabled={soldOut} onClick={()=>addSimpleProduct(product)}>{soldOut ? 'Sold out' : 'Add to cart'}</button>}</div></div>
      </article>;
    })}</section>
    {filtered.length===0&&<div className="store-empty"><h3>No products found</h3><p>Try another category or search term.</p></div>}
    <div className={`cart-overlay ${cartOpen?'open':''}`} onClick={()=>setCartOpen(false)}/>
    <aside className={`cart-drawer ${cartOpen?'open':''}`} aria-label="Shopping cart"><div className="cart-header"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button onClick={()=>setCartOpen(false)} aria-label="Close cart"><X/></button></div><div className="cart-items">{cart.length===0?<div className="empty-cart"><ShoppingBag/><h3>Your cart is empty</h3><p>Add merchandise to begin your order.</p></div>:cart.map(item=>{const key=cartKey(item);const max=availableQuantity(item.product,item.size);return <article className="cart-item" key={key}><Image src={item.product.image} alt="" width={120} height={120} unoptimized/><div><h3>{item.product.name}</h3><p>{[item.size,item.colour].filter(Boolean).join(' · ') || item.product.category}</p><strong>€{discountedPrice(item.product.price).toFixed(2)}</strong><div className="quantity-control"><button onClick={()=>changeQuantity(key,-1)}><Minus size={14}/></button><span>{item.quantity}</span><button disabled={Number.isFinite(max)&&item.quantity>=max} onClick={()=>changeQuantity(key,1)}><Plus size={14}/></button></div></div></article>})}</div><div className="cart-summary"><div><span>Subtotal</span><strong>€{subtotal.toFixed(2)}</strong></div>{discountPercent>0&&<p>{discountPercent}% active-member discount included. Stripe will verify your membership before charging.</p>}<p>Delivery address is collected securely at checkout.</p><Link href="/checkout" className={`checkout-button ${cart.length===0?'disabled':''}`}>Proceed to checkout</Link></div></aside>
  </>;
}
