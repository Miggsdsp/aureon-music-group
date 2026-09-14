import Link from 'next/link';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue } from '@/lib/public-catalogue';
import { Header } from '@/components/Header';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';
import { NewReleases } from '@/components/discovery/NewReleases';

export const metadata = {
  title: 'Discover Aureon Music',
  description: 'Discover personalised playlists, trending songs and emerging releases across Aureon Music Group.',
  alternates: { canonical: '/discover' },
};

export const revalidate = 300;

export default async function DiscoverPage() {
  const [artists, albums, songs] = await Promise.all([getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs')]);
  const catalogue = makePublicCatalogue({ artists, albums, songs });
  return <main><Header /><section className="content-panel"><p className="eyebrow">Aureon discovery</p><h1>Discover Aureon Music</h1><p>Explore original songs, albums and artists across country-pop, Latin pop, deep house, Afrobeats, reggae and modern pop. Listen to public previews and find your next favourite release.</p><p><Link href="/artists">Meet the artists</Link> · <Link href="/music">Browse the music catalogue</Link> · <Link href="/genres/all">Explore all genres</Link></p></section><RecommendedPlaylists /><TrendingSongs initialWindow="7d" /><PublicCatalogueProvider catalogue={initialCatalogueFor(catalogue, 'discover')}><NewReleases showFilters limit={16} /></PublicCatalogueProvider></main>;
}
