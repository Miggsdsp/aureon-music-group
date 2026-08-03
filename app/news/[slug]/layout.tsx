import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, safeJsonLd, SITE_NAME, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedRecord('newsArticles', slug);
  if (!article) return { title: 'Article not found', robots: { index: false, follow: false } };
  const title = text(article.title, 'Aureon News');
  const description = text(article.seoDescription || article.excerpt || article.description || article.body, `Read the latest news from ${SITE_NAME}.`).slice(0, 160);
  return buildMetadata({ title, description, path: `/news/${article.slug || slug}`, image: article.featuredImageUrl || article.imageUrl, type: 'article' });
}

export default async function NewsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getPublishedRecord('newsArticles', slug);
  if (!article) return children;
  const title = text(article.title, 'Aureon News');
  const path = `/news/${article.slug || slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${SITE_URL}${path}#article`,
    headline: title,
    description: text(article.excerpt || article.description || article.body),
    image: article.featuredImageUrl || article.imageUrl,
    datePublished: article.publishDate || article.publishAt || article.createdAt,
    dateModified: article.updatedAt || article.publishDate || article.createdAt,
    mainEntityOfPage: `${SITE_URL}${path}`,
    author: article.author ? { '@type': 'Person', name: article.author } : { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/branding/Aureon_Header_Logo.png` } },
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'News', path: '/news' }, { name: title, path }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
