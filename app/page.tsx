import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { DeferredHomeFeaturedContent } from '@/components/DeferredHomeFeaturedContent';
import { ContinueListening } from '@/components/discovery/ContinueListening';
import { PersonalisedHome } from '@/components/discovery/PersonalisedHome';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';
import { NewReleases } from '@/components/discovery/NewReleases';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';
import { CatalogueTrustSections } from '@/components/trust/CatalogueTrustSections';

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicHero />
      <ContinueListening />
      <PersonalisedHome />
      <TrendingSongs compact />
      <NewReleases compact showFilters={false} limit={8} />
      <RecommendedPlaylists compact />
      <DeferredHomeFeaturedContent />
      <CatalogueTrustSections />
    </main>
  );
}
