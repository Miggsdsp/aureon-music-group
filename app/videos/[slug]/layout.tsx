import type { Metadata } from 'next';
import { buildMetadata, breadcrumbSchema, getPublishedRecord, safeJsonLd, SITE_URL, text } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const video = await getPublishedRecord('videos', slug) || await getPublishedRecord('videoAlbums', slug);
  if (!video) return { title: 'Video not found', robots: { index: false, follow: false } };
  const title = text(video.title || video.name, 'Aureon Video');
  const artist = text(video.artistName || video.artist, 'Aureon Music Group');
  const description = text(video.seoDescription || video.description, `Watch ${title} by ${artist} on Aureon Music Group.`).slice(0, 160);
  return buildMetadata({ title: `${title} by ${artist}`, description, path: `/videos/${video.slug || slug}`, image: video.thumbnailUrl || video.coverImageUrl || video.coverUrl });
}

export default async function VideoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = await getPublishedRecord('videos', slug);
  if (!video) return children;
  const title = text(video.title || video.name, 'Aureon Video');
  const path = `/videos/${video.slug || slug}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${SITE_URL}${path}#video`,
    name: title,
    description: text(video.description),
    thumbnailUrl: video.thumbnailUrl ? [video.thumbnailUrl] : undefined,
    uploadDate: video.releaseDate || video.publishDate || video.createdAt,
    duration: video.isoDuration || undefined,
    contentUrl: video.videoUrl || undefined,
    embedUrl: video.youtubeUrl || video.vimeoUrl || undefined,
    url: `${SITE_URL}${path}`,
    musicBy: video.artistName ? { '@type': 'MusicGroup', name: video.artistName } : undefined,
  };
  const breadcrumbs = breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Videos', path: '/videos' }, { name: title, path }]);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([schema, breadcrumbs]) }} />{children}</>;
}
