import { Header } from '@/components/Header';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';

export const metadata = {
  title: 'Aureon Charts',
  description: 'Discover the songs gaining the strongest momentum across Aureon Music Group.',
  alternates: { canonical: '/charts' },
};

export default function ChartsPage() {
  return <main><Header /><TrendingSongs /></main>;
}
