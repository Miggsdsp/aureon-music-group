import { Header } from '@/components/Header';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';

export const metadata = {
  title: 'Discover Aureon Music',
  description: 'Discover trending songs and emerging releases across Aureon Music Group.',
  alternates: { canonical: '/discover' },
};

export default function DiscoverPage() {
  return <main><Header /><TrendingSongs initialWindow="7d" /></main>;
}
