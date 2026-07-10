import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getNewsArticle, newsArticles } from '@/data/news';

export const dynamicParams = false;

type NewsPageParams = Promise<{ slug: string }>;

export function generateStaticParams() {
  return newsArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: NewsPageParams }) {
  const { slug } = await params;
  const article = getNewsArticle(slug);

  if (!article) return { title: 'News | Aureon Music Group' };

  return {
    title: `${article.title} | Aureon Music Group`,
    description: article.excerpt
  };
}

export default async function NewsArticlePage({ params }: { params: NewsPageParams }) {
  const { slug } = await params;
  const article = getNewsArticle(slug);

  if (!article) notFound();

  return (
    <main className="page-shell news-article-page">
      <Header />

      <section className="news-article-hero">
        <div className="news-article-image">
          <Image src={article.image} alt={article.title} width={1400} height={900} unoptimized />
        </div>
        <div className="news-article-heading">
          <Link href="/news" className="back-link"><ArrowLeft size={16} /> Back to news</Link>
          <p className="eyebrow">{article.category} · {article.date} · {article.readTime}</p>
          <h1>{article.title}</h1>
          <p>{article.excerpt}</p>
        </div>
      </section>

      <article className="news-article-body">
        {article.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {article.artistSlug ? <Link className="ghost-button" href={`/artists/${article.artistSlug}`}>View artist profile →</Link> : null}
      </article>

      <Footer />
    </main>
  );
}
