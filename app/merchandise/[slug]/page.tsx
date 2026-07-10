import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Truck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { products,getProductBySlug } from '@/data/products';

export const dynamicParams=false;
type Params=Promise<{slug:string}>;
export function generateStaticParams(){return products.map(product=>({slug:product.slug}))}
export default async function ProductPage({params}:{params:Params}){
 const {slug}=await params;const product=getProductBySlug(slug);if(!product)notFound();
 return <main className="page-shell product-detail-page"><Header/><section className="product-detail-hero">
  <div className="product-detail-image"><Image src={product.image} alt={product.name} width={1000} height={1000} unoptimized/></div>
  <div className="product-detail-copy"><Link href="/merchandise" className="back-link"><ArrowLeft size={16}/>Back to store</Link><p className="eyebrow">{product.category} · {product.artist}</p><h1>{product.name}</h1><div className="detail-price">€{product.price.toFixed(2)}</div><p>{product.description}</p>
  {product.sizes&&<label>Size<select>{product.sizes.map(size=><option key={size}>{size}</option>)}</select></label>}
  {product.colours&&<label>Colour<select>{product.colours.map(colour=><option key={colour}>{colour}</option>)}</select></label>}
  <Link href="/merchandise" className="primary-button">Add from store cart</Link>
  <div className="product-benefits"><span><Truck/>Worldwide delivery</span><span><ShieldCheck/>Secure checkout</span></div></div>
 </section><Footer/></main>
}
