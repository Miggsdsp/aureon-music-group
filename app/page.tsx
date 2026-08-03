import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { DeferredHomeFeaturedContent } from '@/components/DeferredHomeFeaturedContent';
import { ContinueListening } from '@/components/discovery/ContinueListening';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />
      <ContinueListening />
      <TrendingSongs compact />
      <DeferredHomeFeaturedContent />
    </main>
  );
}
