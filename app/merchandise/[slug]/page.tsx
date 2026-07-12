'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck, Truck } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getProductBySlug } from '@/data/products';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { useSiteFeatures } from '@/lib/useSiteFeatures';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { features, loading: featuresLoading } = useSiteFeatures();
  const fallback = getProductBySlug(slug) as any;
  const { data: product, loading } = usePublishedDocument<any>('products', slug, fallback || null);

  useEffect(() => {
    if (!featuresLoading && !features.merchandiseEnabled) router.replace('/music');
  }, [features.merchandiseEnabled, featuresLoading, router]);

  if (featuresLoading || !features.merchandiseEnabled) return null;
  if (!product && !loading) return <main className="page-shell"><Header /><section className="content-panel"><h1>Product not found</h1></section><Footer /></main>;
  if (!product) return null;

  const image = product.imageUrl || product.image || '/images/branding/Aureon_Header_Logo.png';
  const sizes = Array.isArray(product.sizes) ? product.sizes : String(product.sizes || '').split(',').filter(Boolean);
  const colours = Array.isArray(product.colours) ? product.colours : String(product.colours || '').split(',').filter(Boolean);

  return <main className="page-shell product-detail-page"><Header /><section className="product-detail-hero">
    <div className="product-detail-image"><Image src={image} alt={product.name} width={1000} height={1000} unoptimized /></div>
    <div className="product-detail-copy"><Link href="/merchandise" className="back-link"><ArrowLeft size={16} /> Back to store</Link><p className="eyebrow">{product.category} · {product.artist || 'Aureon Music Group'}</p><h1>{product.name}</h1><div className="detail-price">€{Number(product.price || 0).toFixed(2)}</div><p>{product.description}</p>
      {sizes.length ? <label>Size<select>{sizes.map((size: string) => <option key={size}>{size.trim()}</option>)}</select></label> : null}
      {colours.length ? <label>Colour<select>{colours.map((colour: string) => <option key={colour}>{colour.trim()}</option>)}</select></label> : null}
      <Link href="/merchandise" className="primary-button">Add from store cart</Link><div className="product-benefits"><span><Truck />Worldwide delivery</span><span><ShieldCheck />Secure checkout</span></div></div>
  </section><Footer /></main>;
}
