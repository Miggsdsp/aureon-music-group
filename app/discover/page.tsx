import { Header } from '@/components/Header';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';
import { NewReleases } from '@/components/discovery/NewReleases';

export const metadata = {
  title: 'Discover Aureon Music',
  description: 'Discover personalised playlists, trending songs and emerging releases across Aureon Music Group.',
  alternates: { canonical: '/discover' },
};

export default function DiscoverPage() {
  return <main><Header /><RecommendedPlaylists /><TrendingSongs initialWindow="7d" /><NewReleases showFilters limit={16} /></main>;
}
