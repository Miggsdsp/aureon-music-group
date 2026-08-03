import { getPublishedRecords, SITE_URL, text } from '@/lib/seo';

export const revalidate = 3600;

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function isoDate(value: any) {
  if (value?.toDate) return value.toDate().toISOString();
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString();
}

export async function GET() {
  const videos = await getPublishedRecords('videos');
  const body = videos.filter(item => item.thumbnailUrl && (item.videoUrl || item.youtubeUrl || item.vimeoUrl || item.externalUrl)).map(item => {
    const path = `/videos/${item.slug || item.id}`;
    const title = text(item.title, 'Aureon video');
    const description = text(item.description || item.artistName, `Watch ${title} on Aureon Music Group.`).slice(0, 2048);
    const player = item.videoUrl || item.youtubeUrl || item.vimeoUrl || item.externalUrl;
    return `<url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc><video:video><video:thumbnail_loc>${escapeXml(String(item.thumbnailUrl))}</video:thumbnail_loc><video:title>${escapeXml(title)}</video:title><video:description>${escapeXml(description)}</video:description><video:publication_date>${escapeXml(isoDate(item.releaseDate || item.publishDate || item.createdAt))}</video:publication_date><video:player_loc>${escapeXml(String(player))}</video:player_loc></video:video></url>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${body}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
