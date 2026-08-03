import type { MetadataRoute } from 'next';
import { getPublishedRecords, SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

function modified(value: any) {
  if (value?.toDate) return value.toDate();
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ['', '/artists', '/music', '/videos', '/news', '/merchandise', '/membership', '/about', '/contact', '/legal'];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(path => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  const [artists, albums, videos, news, legal] = await Promise.all([
    getPublishedRecords('artists'),
    getPublishedRecords('albums'),
    getPublishedRecords('videos'),
    getPublishedRecords('newsArticles'),
    getPublishedRecords('legalDocuments'),
  ]);

  const dynamic: MetadataRoute.Sitemap = [
    ...artists.map(item => ({ url: `${SITE_URL}/artists/${item.slug || item.id}`, lastModified: modified(item.updatedAt || item.createdAt), changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...albums.map(item => ({ url: `${SITE_URL}/music/${item.slug || item.id}`, lastModified: modified(item.updatedAt || item.releaseDate), changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...videos.map(item => ({ url: `${SITE_URL}/videos/${item.slug || item.id}`, lastModified: modified(item.updatedAt || item.releaseDate), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...news.map(item => ({ url: `${SITE_URL}/news/${item.slug || item.id}`, lastModified: modified(item.updatedAt || item.publishDate), changeFrequency: 'monthly' as const, priority: 0.75 })),
    ...legal.map(item => ({ url: `${SITE_URL}/legal/${item.slug || item.id}`, lastModified: modified(item.updatedAt), changeFrequency: 'yearly' as const, priority: 0.4 })),
  ];

  return [...staticEntries, ...dynamic];
}
