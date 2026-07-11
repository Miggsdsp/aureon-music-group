'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getNewsArticle } from '@/data/news';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export default function NewsArticlePage(){
 const {slug}=useParams<{slug:string}>();
 const fallback=getNewsArticle(slug) as any;
 const {data:article,loading}=usePublishedDocument<any>('newsArticles',slug,fallback||null);
 if(!article&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Article not found</h1></section><Footer/></main>;
 if(!article)return null;
 const image=article.imageUrl||article.image||'/images/branding/Aureon_Header_Logo.png';
 const body=Array.isArray(article.body)?article.body:String(article.body||article.content||'').split('\n').filter(Boolean);
 return <main className="page-shell news-article-page"><Header/>
  <section className="news-article-hero"><div className="news-article-image"><Image src={image} alt={article.title} width={1400} height={900} unoptimized/></div><div className="news-article-heading"><Link href="/news" className="back-link"><ArrowLeft size={16}/> Back to news</Link><p className="eyebrow">{article.category} · {article.date||article.publishDate||''} · {article.readTime||''}</p><h1>{article.title}</h1><p>{article.excerpt||article.summary}</p></div></section>
  <article className="news-article-body">{body.map((paragraph:string,index:number)=><p key={`${index}-${paragraph.slice(0,20)}`}>{paragraph}</p>)}{article.artistSlug?<Link className="ghost-button" href={`/artists/${article.artistSlug}`}>View artist profile →</Link>:null}</article>
  <Footer/></main>;
}
