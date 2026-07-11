'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag, SlidersHorizontal, X } from 'lucide-react';
import { productCategories, products as fallbackProducts, Product } from '@/data/products';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type ProductRecord = PublicRecord & Partial<Product> & { name:string; slug:string; price:number; imageUrl?:string };
type CartItem={product:Product;quantity:number;size?:string;colour?:string};

export function MerchStore(){
 const { items: records } = usePublishedCollection<ProductRecord>('products', fallbackProducts.map((product)=>({ ...product, id: product.id } as ProductRecord)));
 const products = records.map((item)=>({ ...item, image: item.imageUrl || item.image || '/images/branding/Aureon_Header_Logo.png' } as Product));
 const categories = ['All', ...Array.from(new Set(products.map((product)=>product.category).filter(Boolean)))] as string[];
 const [category,setCategory]=useState('All');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('featured');
 const [cart,setCart]=useState<CartItem[]>([]);
 const [cartOpen,setCartOpen]=useState(false);

 useEffect(()=>{const saved=localStorage.getItem('aureon-cart');if(saved){try{setCart(JSON.parse(saved))}catch{}}},[]);
 useEffect(()=>{localStorage.setItem('aureon-cart',JSON.stringify(cart))},[cart]);

 const filtered=useMemo(()=>{
  let list=products.filter(p=>(category==='All'||p.category===category)&&(`${p.name} ${p.artist||''}`.toLowerCase().includes(query.toLowerCase())));
  if(sort==='low') list=[...list].sort((a,b)=>a.price-b.price);
  if(sort==='high') list=[...list].sort((a,b)=>b.price-a.price);
  if(sort==='name') list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
  return list;
 },[products,category,query,sort]);

 const itemCount=cart.reduce((sum,item)=>sum+item.quantity,0);
 const subtotal=cart.reduce((sum,item)=>sum+(item.product.price*item.quantity),0);
 function addToCart(product:Product){setCart(current=>{const existing=current.find(item=>item.product.id===product.id);if(existing)return current.map(item=>item.product.id===product.id?{...item,quantity:item.quantity+1}:item);return [...current,{product,quantity:1,size:product.sizes?.[0],colour:product.colours?.[0]}];});setCartOpen(true)}
 function changeQuantity(id:string,delta:number){setCart(current=>current.map(item=>item.product.id===id?{...item,quantity:Math.max(0,item.quantity+delta)}:item).filter(item=>item.quantity>0))}

 return <>
  <section className="store-toolbar"><div className="store-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products or artists"/></div><div className="store-sort"><SlidersHorizontal size={17}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option></select></div><button className="cart-button" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/>Cart <span>{itemCount}</span></button></section>
  <nav className="store-categories" aria-label="Merchandise categories">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</nav>
  <section className="product-grid">{filtered.map(product=><article className="product-card" key={product.id}><Link href={`/merchandise/${product.slug}`} className="product-image-wrap">{product.badge&&<span className="product-badge">{product.badge}</span>}<Image src={product.image} alt={product.name} width={800} height={800} unoptimized className="product-image"/></Link><div className="product-card-copy"><p>{product.artist}</p><Link href={`/merchandise/${product.slug}`}><h3>{product.name}</h3></Link><div className="product-price">€{Number(product.price).toFixed(2)}</div><div className="product-actions"><Link href={`/merchandise/${product.slug}`} className="product-view">View product</Link><button onClick={()=>addToCart(product)}>Add to cart</button></div></div></article>)}</section>
  {filtered.length===0&&<div className="store-empty"><h3>No products found</h3><p>Try another category or search term.</p></div>}
  <div className={`cart-overlay ${cartOpen?'open':''}`} onClick={()=>setCartOpen(false)}/><aside className={`cart-drawer ${cartOpen?'open':''}`} aria-label="Shopping cart"><div className="cart-header"><div><p className="eyebrow">Your order</p><h2>Shopping cart</h2></div><button onClick={()=>setCartOpen(false)} aria-label="Close cart"><X/></button></div><div className="cart-items">{cart.length===0?<div className="empty-cart"><ShoppingBag/><h3>Your cart is empty</h3><p>Add merchandise to begin your order.</p></div>:cart.map(item=><article className="cart-item" key={item.product.id}><Image src={item.product.image} alt="" width={120} height={120} unoptimized/><div><h3>{item.product.name}</h3><p>{item.size||item.colour||item.product.category}</p><strong>€{item.product.price.toFixed(2)}</strong><div className="quantity-control"><button onClick={()=>changeQuantity(item.product.id,-1)}><Minus size={14}/></button><span>{item.quantity}</span><button onClick={()=>changeQuantity(item.product.id,1)}><Plus size={14}/></button></div></div></article>)}</div><div className="cart-summary"><div><span>Subtotal</span><strong>€{subtotal.toFixed(2)}</strong></div><p>Shipping and taxes calculated at checkout.</p><Link href="/checkout" className={`checkout-button ${cart.length===0?'disabled':''}`}>Proceed to checkout</Link></div></aside>
 </>
}
