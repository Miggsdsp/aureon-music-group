import type { MetadataRoute } from 'next';
import { getPublishedRecords } from '@/lib/seo';
import { contentLastModified } from '@/lib/public-content';

const SITE_URL = 'https://www.aureonmusicgroup.com';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ['', '/artists', '/music', '/videos', '/news', '/merchandise', '/membership', '/about', '/contact', '/legal'];
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map(path => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));

  const [artists, albums, songs, videos, news, legal] = await Promise.all([
    getPublishedRecords('artists'),
    getPublishedRecords('albums'),
    getPublishedRecords('songs'),
    getPublishedRecords('videos'),
    getPublishedRecords('newsArticles'),
    getPublishedRecords('legalDocuments'),
  ]);

  const dynamic: MetadataRoute.Sitemap = [
    ...artists.map(item => ({ url: `${SITE_URL}/artists/${item.slug || item.id}`, lastModified: contentLastModified(item), changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...albums.map(item => ({ url: `${SITE_URL}/music/${item.slug || item.id}`, lastModified: contentLastModified(item), changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...songs.filter(item => typeof item.slug === 'string' && item.slug.trim() && !/[/?#]/.test(item.slug)).map(item => ({ url: `${SITE_URL}/songs/${encodeURIComponent(item.slug)}`, lastModified: contentLastModified(item), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...videos.map(item => ({ url: `${SITE_URL}/videos/${item.slug || item.id}`, lastModified: contentLastModified(item), changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...news.map(item => ({ url: `${SITE_URL}/news/${item.slug || item.id}`, lastModified: contentLastModified(item), changeFrequency: 'monthly' as const, priority: 0.75 })),
    ...legal.map(item => ({ url: `${SITE_URL}/legal/${item.slug || item.id}`, lastModified: contentLastModified(item), changeFrequency: 'yearly' as const, priority: 0.4 })),
  ];

  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...staticEntries, ...dynamic]) {
    const previous = entries.get(entry.url);
    if (!previous || (!previous.lastModified && entry.lastModified)) entries.set(entry.url, entry);
  }
  return [...entries.values()];
}
