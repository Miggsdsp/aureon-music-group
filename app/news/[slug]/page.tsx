'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useI18n } from '@/components/i18n/I18nProvider';
import { localePath } from '@/lib/i18n/config';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

function localizedArticle(article:any,locale:string){
 if(locale==='en')return article;
 const nested=article?.translations?.[locale]||article?.locales?.[locale]||article?.i18n?.[locale]||{};
 const suffix=locale.toUpperCase();
 const pick=(key:string)=>nested?.[key]??article?.[`${key}_${locale}`]??article?.[`${key}${suffix}`]??article?.[key];
 return {...article,...nested,title:pick('title'),excerpt:pick('excerpt')??pick('summary'),summary:pick('summary')??pick('excerpt'),body:pick('body')??pick('content'),content:pick('content')??pick('body'),category:pick('category')};
}

export default function NewsArticlePage(){
 const {slug}=useParams<{slug:string}>();
 const {locale}=useI18n();
 const {data:rawArticle,loading}=usePublishedDocument<any>('newsArticles',slug,null);
 if(!rawArticle&&!loading)return <main className="page-shell"><Header/><section className="content-panel"><h1>Article not found</h1><p>This story is not published or has been removed.</p></section><Footer/></main>;
 if(!rawArticle)return null;
 const article=localizedArticle(rawArticle,locale);
 const image=article.imageUrl||article.image||'/images/branding/Aureon_Header_Logo.png';
 const body=Array.isArray(article.body)?article.body:String(article.body||article.content||'').split('\n').filter(Boolean);
 return <main className="page-shell news-article-page"><Header/>
  <section className="news-article-hero"><div className="news-article-image"><Image src={image} alt={article.title} width={1400} height={900} unoptimized/></div><div className="news-article-heading"><Link href={localePath('/news',locale)} className="back-link"><ArrowLeft size={16}/> Back to news</Link><p className="eyebrow">{article.category} · {article.date||article.publishDate||''} · {article.readTime||''}</p><h1>{article.title}</h1><p>{article.excerpt||article.summary}</p></div></section>
  <article className="news-article-body">{body.map((paragraph:string,index:number)=><p key={`${index}-${paragraph.slice(0,20)}`}>{paragraph}</p>)}{article.artistSlug?<Link className="ghost-button" href={localePath(`/artists/${article.artistSlug}`,locale)}>View artist profile →</Link>:null}</article>
  <Footer/></main>;
}