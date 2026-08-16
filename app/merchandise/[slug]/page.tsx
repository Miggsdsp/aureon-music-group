'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getProductBySlug, type Product } from '@/data/products';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { useSiteFeatures } from '@/lib/useSiteFeatures';
import { availableQuantity, isSoldOut, normaliseColours, normaliseSizes, normaliseSizeStock } from '@/lib/merch-inventory';

type CartItem={product:Product;quantity:number;size?:string;colour?:string};
const cartKey=(item:Pick<CartItem,'product'|'size'|'colour'>)=>`${item.product.id}::${item.size||''}::${item.colour||''}`;

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { features, loading: featuresLoading } = useSiteFeatures();
  const fallback = getProductBySlug(slug) as any;
  const { data: rawProduct, loading } = usePublishedDocument<any>('products', slug, fallback || null);
  const product = rawProduct ? ({...rawProduct,id:rawProduct.id||fallback?.id||slug,image:rawProduct.imageUrl||rawProduct.image||'/images/branding/Aureon_Header_Logo.png',sizes:normaliseSizes(rawProduct.sizes),colours:normaliseColours(rawProduct.colours),sizeStock:normaliseSizeStock(rawProduct.sizeStock),digital:false} as Product) : null;
  const [size,setSize]=useState('');
  const [colour,setColour]=useState('');
  const [quantity,setQuantity]=useState(1);
  const [message,setMessage]=useState('');

  useEffect(() => { if (!featuresLoading && !features.merchandiseEnabled) router.replace('/music'); }, [features.merchandiseEnabled, featuresLoading, router]);
  useEffect(()=>{if(!product)return;const firstAvailable=(product.sizes||[]).find(option=>availableQuantity(product,option)>0)||product.sizes?.[0]||'';setSize(firstAvailable);setColour(product.colours?.[0]||'');setQuantity(1);},[product?.id]);

  const soldOut=product?isSoldOut(product):false;
  const selectedAvailable=useMemo(()=>product?availableQuantity(product,size||undefined):0,[product,size]);
  const maxQuantity=Number.isFinite(selectedAvailable)?Math.min(10,selectedAvailable):10;

  function addToCart(){
    if(!product||soldOut||maxQuantity<=0)return;
    if(product.sizes?.length&&!size){setMessage('Please choose a size.');return;}
    const nextItem:CartItem={product,quantity:Math.max(1,Math.min(quantity,maxQuantity)),size:size||undefined,colour:colour||undefined};
    let cart:CartItem[]=[];try{cart=JSON.parse(localStorage.getItem('aureon-cart')||'[]');}catch{}
    const key=cartKey(nextItem);const existing=cart.find(item=>cartKey(item)===key);
    const next=existing?cart.map(item=>cartKey(item)===key?{...item,quantity:Math.min(maxQuantity,item.quantity+nextItem.quantity)}:item):[...cart,nextItem];
    localStorage.setItem('aureon-cart',JSON.stringify(next));window.dispatchEvent(new Event('aureon-cart-updated'));setMessage('Added to your cart.');
  }

  if (featuresLoading || !features.merchandiseEnabled) return null;
  if (!product && !loading) return <main className="page-shell"><Header /><section className="content-panel"><h1>Product not found</h1></section><Footer /></main>;
  if (!product) return null;

  return <main className="page-shell product-detail-page"><Header /><section className="product-detail-hero">
    <div className="product-detail-image" style={{position:'relative'}}>{soldOut&&<span style={{position:'absolute',left:0,right:0,top:'44%',zIndex:5,background:'#b00020',color:'#fff',padding:'14px 10px',fontWeight:900,textAlign:'center',letterSpacing:'.14em'}}>SOLD OUT</span>}<Image src={product.image} alt={product.name} width={1000} height={1000} unoptimized /></div>
    <div className="product-detail-copy"><Link href="/merchandise" className="back-link"><ArrowLeft size={16} /> Back to store</Link><p className="eyebrow">{product.category} · {product.artist || 'Aureon Music Group'}</p><h1>{product.name}</h1><div className="detail-price">€{Number(product.price || 0).toFixed(2)}</div><p>{product.description}</p>
      {product.sizes?.length ? <label>Size<select value={size} onChange={event=>{setSize(event.target.value);setQuantity(1);}}>{product.sizes.map(option=>{const qty=availableQuantity(product,option);return <option key={option} value={option} disabled={qty<=0}>{option}{qty<=0?' — Sold out':Number.isFinite(qty)?` — ${qty} available`:''}</option>})}</select></label> : null}
      {product.colours?.length ? <label>Colour<select value={colour} onChange={event=>setColour(event.target.value)}>{product.colours.map(option=><option key={option}>{option}</option>)}</select></label> : null}
      <label>Quantity<div className="quantity-control" style={{maxWidth:150}}><button type="button" disabled={quantity<=1} onClick={()=>setQuantity(value=>Math.max(1,value-1))}><Minus size={14}/></button><span>{quantity}</span><button type="button" disabled={quantity>=maxQuantity} onClick={()=>setQuantity(value=>Math.min(maxQuantity,value+1))}><Plus size={14}/></button></div></label>
      {Number.isFinite(selectedAvailable)&&!soldOut&&<p>{selectedAvailable} currently available{size?` in ${size}`:''}.</p>}
      {message&&<p className="admin-cms-message" role="status">{message}</p>}
      <button type="button" className="primary-button" disabled={soldOut||maxQuantity<=0} onClick={addToCart}><ShoppingBag size={17}/> {soldOut?'Sold out':'Add to cart'}</button><div className="product-benefits"><span><Truck />Worldwide delivery</span><span><ShieldCheck />Secure checkout</span></div></div>
  </section><Footer /></main>;
}
