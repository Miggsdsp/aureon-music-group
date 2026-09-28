import { Footer, type FooterSongRecord } from '@/components/Footer';
import { publicCatalogueRecord } from '@/lib/public-catalogue';
import { getPublishedRecords } from '@/lib/seo';

function releaseTime(song: Record<string, any>) {
  const value = song.releaseDate || song.publishedAt || song.publishDate || song.createdAt || song.updatedAt || '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export async function ServerFooter() {
  let latestRelease: FooterSongRecord | null = null;

  try {
    const songs = await getPublishedRecords('songs');
    latestRelease = songs
      .map(song => publicCatalogueRecord(song, true) as FooterSongRecord)
      .filter(song => song.slug && song.title)
      .sort((a, b) => releaseTime(b) - releaseTime(a) || String(a.title).localeCompare(String(b.title)))[0] || null;
  } catch {
    latestRelease = null;
  }

  return <Footer initialLatestRelease={latestRelease} />;
}
