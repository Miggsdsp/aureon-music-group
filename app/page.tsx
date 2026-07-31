import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { DeferredHomeFeaturedContent } from '@/components/DeferredHomeFeaturedContent';

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />
      <DeferredHomeFeaturedContent />
    </main>
  );
}
