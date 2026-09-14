import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Allow crawlers to read explicit noindex metadata / X-Robots-Tag.
        // Authentication, not robots.txt, protects private data.
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/image-sitemap.xml`,
      `${SITE_URL}/video-sitemap.xml`,
    ],
    host: SITE_URL,
  };
}
