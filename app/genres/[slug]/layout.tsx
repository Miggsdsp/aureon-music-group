import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublicGenre } from '@/lib/public-genres';
import { buildMetadata, breadcrumbSchema, safeJsonLd, SITE_URL } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const genre = await getPublicGenre(slug);
  if (genre === null) notFound();
  const name = genre || 'All Music';
  return buildMetadata({
    title: `${name} Music & New Releases`,
    description: `Discover ${name.toLowerCase()} music, artists, albums and new releases from Aureon Music Group.`,
    path: `/genres/${slug}`,
  });
}

export default async function GenreLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const genre = await getPublicGenre(slug);
  if (genre === null) notFound();
  const name = genre || 'All Music';
  const path = `/genres/${slug}`;
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_URL}${path}#collection`,
    name: `${name} Music & New Releases`,
    url: `${SITE_URL}${path}`,
    description: `Discover ${name.toLowerCase()} music, artists, albums and new releases from Aureon Music Group.`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  };
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Discover', path: '/discover' },
    { name, path },
  ]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([collectionSchema, breadcrumbs]) }} />{children}</>;
}
