import { getPublishedRecords, SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  const [artists, albums, songs, videos, news] = await Promise.all([
    getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs'), getPublishedRecords('videos'), getPublishedRecords('newsArticles'),
  ]);
  const rows = [
    ...artists.map(item => ({ path: `/artists/${item.slug || item.id}`, image: item.profileImageUrl || item.logoUrl || item.image, title: item.name || item.title })),
    ...albums.map(item => ({ path: `/music/${item.slug || item.id}`, image: item.coverImageUrl || item.coverUrl || item.imageUrl, title: item.title || item.name })),
    ...songs.map(item => ({ path: '/music', image: item.coverImageUrl || item.imageUrl, title: item.title || item.name })),
    ...videos.map(item => ({ path: `/videos/${item.slug || item.id}`, image: item.thumbnailUrl, title: item.title })),
    ...news.map(item => ({ path: `/news/${item.slug || item.id}`, image: item.featuredImageUrl || item.imageUrl, title: item.title })),
  ].filter(item => item.image);

  const body = rows.map(item => `<url><loc>${escapeXml(`${SITE_URL}${item.path}`)}</loc><image:image><image:loc>${escapeXml(String(item.image))}</image:loc><image:title>${escapeXml(String(item.title || 'Aureon Music Group'))}</image:title></image:image></url>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
