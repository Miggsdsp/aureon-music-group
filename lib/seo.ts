import type { Metadata } from 'next';
import { cache } from 'react';
import { adminFirestore } from '@/lib/firebase-admin';
import { artistLookupSlugs } from '@/lib/artist-identity';
import { isPublicContent, normalizePublicRecord } from '@/lib/public-content';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com').replace(/\/$/, '');
export const SITE_NAME = 'Aureon Music Group';
export const DEFAULT_IMAGE = '/images/branding/Aureon_Header_Logo.png';

export type SeoRecord = Record<string, any> & { id?: string };

export function absoluteUrl(value?: string) {
  if (!value) return `${SITE_URL}${DEFAULT_IMAGE}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

export function text(value: unknown, fallback = '') {
  return String(value || fallback).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export const getPublishedRecord = cache(async (collectionName: string, slug: string): Promise<SeoRecord | null> => {
  if (!slug || slug.includes('/')) return null;
  const candidates = collectionName === 'artists' ? artistLookupSlugs(slug) : [slug];
  for (const candidate of candidates) {
    const direct = await adminFirestore.collection(collectionName).doc(candidate).get();
    if (direct.exists && isPublicContent(direct.data()!)) return normalizePublicRecord(direct.data()!, direct.id);
    const snapshot = await adminFirestore.collection(collectionName).where('slug', '==', candidate).where('status', '==', 'published').limit(1).get();
    if (!snapshot.empty) {
      const record = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      if (isPublicContent(record)) return normalizePublicRecord(record, snapshot.docs[0].id);
    }
  }
  return null;
});

export const getPublishedRecords = cache(async (collectionName: string): Promise<SeoRecord[]> => {
  const snapshot = await adminFirestore.collection(collectionName).where('status', '==', 'published').get();
  return snapshot.docs.filter(doc => isPublicContent(doc.data())).map(doc => normalizePublicRecord(doc.data(), doc.id));
});

export function buildMetadata({ title, description, path, image, type = 'website' }: { title: string; description: string; path: string; image?: string; type?: 'website' | 'article' }) : Metadata {
  const canonical = `${SITE_URL}${path}`;
  const socialImage = absoluteUrl(image);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type,
      locale: 'en_IE',
      images: [{ url: socialImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [socialImage] },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${SITE_URL}${item.path}` })),
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
