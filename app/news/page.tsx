'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Newspaper } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { newsArticles as fallbackNews } from '@/data/news';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';

type NewsRecord = PublicRecord & { slug:string; title:string; category?:string; date?:string; excerpt?:string; image?:string; imageUrl?:string; featured?:boolean };
const fallback = fallbackNews.map((article)=>({ ...article, id: article.id } as NewsRecord));

export default function NewsPage() {
  const { items } = usePublishedCollection<NewsRecord>('newsArticles', fallback);
  const ordered = [...items].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const [featured, ...latest] = ordered;
  if(!featured) return <PageShell title="Aureon News" kicker="Latest Stories"><div className="store-empty"><h3>No published stories yet</h3></div></PageShell>;
  const featuredImage = featured.imageUrl || featured.image || '/images/branding/Aureon_Header_Logo.png';
  return <PageShell title="Aureon News" kicker="Latest Stories">
    <section className="news-intro"><div><p className="eyebrow">Official Newsroom</p><h2>Artist stories, releases and Aureon updates</h2></div><p>Read the latest news from Aureon Music Group, including artist announcements, new releases, video launches and company developments.</p></section>
    <Link href={`/news/${featured.slug}`} className="featured-news-card"><div className="featured-news-image"><Image src={featuredImage} alt={featured.title} width={1200} height={800} unoptimized/></div><div className="featured-news-copy"><p>{featured.category} · {featured.date}</p><h2>{featured.title}</h2><span>{featured.excerpt}</span><strong>Read featured story <ArrowRight size={18}/></strong></div></Link>
    <section className="news-grid">{latest.map((article)=>{const image=article.imageUrl||article.image||'/images/branding/Aureon_Header_Logo.png';return <Link href={`/news/${article.slug}`} className="news-card" key={article.id}><div className="news-card-image"><Image src={image} alt={article.title} width={900} height={600} unoptimized/></div><div className="news-card-copy"><p>{article.category} · {article.date}</p><h3>{article.title}</h3><span>{article.excerpt}</span><strong>Read article →</strong></div></Link>})}</section>
    <section className="newsroom-strip"><Newspaper/><div><h3>Aureon Music Group Newsroom</h3><p>New artist stories and company announcements appear here automatically when published in the Control Center.</p></div></section>
  </PageShell>;
}
