import Link from 'next/link';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue } from '@/lib/public-catalogue';
import { Header } from '@/components/Header';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';
import { NewReleases } from '@/components/discovery/NewReleases';
import conversionStyles from '@/components/ConversionCta.module.css';

export const metadata = {
  title: 'Discover Aureon Music',
  description: 'Discover personalised playlists, trending songs and emerging releases across Aureon Music Group.',
  alternates: { canonical: '/discover' },
};

export const revalidate = 300;

export default async function DiscoverPage() {
  const [artists, albums, songs] = await Promise.all([getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs')]);
  const catalogue = makePublicCatalogue({ artists, albums, songs });
  return <main><Header /><section className="content-panel"><p className="eyebrow">Aureon discovery</p><h1>Discover Aureon Music</h1><p>Explore original songs, albums and artists across country-pop, Latin pop, deep house, Afrobeats, reggae and modern pop. Listen to public previews and find your next favourite release.</p><div className={conversionStyles.actions}><Link className="ghost-button" href="/music">Start listening →</Link><Link className="primary-button" href="/artists">Meet the artists →</Link><Link className="primary-button" href="/account?mode=signup">Create free account →</Link></div><p className={conversionStyles.note}>No account is required to preview music. A free account lets you save favourites and build playlists. <Link href="/membership">Compare full-listening memberships</Link>.</p></section><RecommendedPlaylists /><TrendingSongs initialWindow="7d" /><PublicCatalogueProvider catalogue={initialCatalogueFor(catalogue, 'discover')}><NewReleases showFilters limit={16} /></PublicCatalogueProvider></main>;
}
