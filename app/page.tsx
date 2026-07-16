import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { HomeFeaturedContent } from '@/components/HomeFeaturedContent';

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />
      <HomeFeaturedContent />
    </main>
  );
}
