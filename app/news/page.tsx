'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type NewsRecord = PublicRecord & { slug:string; title:string; category?:string; date?:string; publishDate?:string; excerpt?:string; image?:string; imageUrl?:string; featured?:boolean };

export default function NewsPage() {
  const { items, loading } = usePublishedCollection<NewsRecord>('newsArticles', []);
  const ordered = [...items].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const [featured, ...latest] = ordered;
  if (loading) return <PageShell title="Aureon News" kicker="Latest Stories"><div className="store-empty"><h3>Loading newsroom…</h3></div></PageShell>;
  if(!featured) return <PageShell title="Aureon News" kicker="Latest Stories"><div className="store-empty"><h3>No published stories yet</h3><p>Stories published in the Control Center will appear here automatically.</p></div></PageShell>;
  const featuredImage = featured.imageUrl || featured.image || '/images/branding/Aureon_Header_Logo.png';
  return <PageShell title="Aureon News" kicker="Latest Stories">
    <section className="news-intro"><div><p className="eyebrow">Official Newsroom</p><h2>Artist stories, releases and Aureon updates</h2></div><p>Read the latest news from Aureon Music Group, including artist announcements, new releases, video launches and company developments.</p></section>
    <Link href={`/news/${featured.slug}`} className="featured-news-card"><div className="featured-news-image"><Image src={featuredImage} alt={featured.title} width={1200} height={800} unoptimized/></div><div className="featured-news-copy"><p>{featured.category} · {featured.date||featured.publishDate||''}</p><h2>{featured.title}</h2><span>{featured.excerpt}</span><strong>Read featured story <ArrowRight size={18}/></strong></div></Link>
    <section className="news-grid">{latest.map((article)=>{const image=article.imageUrl||article.image||'/images/branding/Aureon_Header_Logo.png';return <Link href={`/news/${article.slug}`} className="news-card" key={article.id}><div className="news-card-image"><Image src={image} alt={article.title} width={900} height={600} unoptimized/></div><div className="news-card-copy"><p>{article.category} · {article.date||article.publishDate||''}</p><h3>{article.title}</h3><span>{article.excerpt}</span><strong>Read article →</strong></div></Link>})}</section>
    <section className="newsroom-strip"><Newspaper/><div><h3>Aureon Music Group Newsroom</h3><p>New artist stories and company announcements appear here automatically when published in the Control Center.</p></div></section>
  </PageShell>;
}