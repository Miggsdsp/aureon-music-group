import { Header } from '@/components/Header';
import { CinematicHero } from '@/components/CinematicHero';
import { DeferredHomeFeaturedContent } from '@/components/DeferredHomeFeaturedContent';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { ContinueListening } from '@/components/discovery/ContinueListening';
import { PersonalisedHome } from '@/components/discovery/PersonalisedHome';
import { TrendingSongs } from '@/components/discovery/TrendingSongs';
import { NewReleases } from '@/components/discovery/NewReleases';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';
import { CatalogueTrustSections } from '@/components/trust/CatalogueTrustSections';
import { getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue } from '@/lib/public-catalogue';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [artists, albums, songs, videos] = await Promise.all([
    getPublishedRecords('artists'),
    getPublishedRecords('albums'),
    getPublishedRecords('songs'),
    getPublishedRecords('videos'),
  ]);
  const catalogue = makePublicCatalogue({ artists, albums, songs, videos });
  const initialCatalogue = initialCatalogueFor(catalogue, 'discover');
  const catalogueCounts = {
    songs: songs.length,
    albums: albums.length,
    artists: artists.length,
    videos: videos.length,
  };

  return (
    <PublicCatalogueProvider catalogue={initialCatalogue}>
      <main>
        <Header />
        <CinematicHero />
        <ContinueListening />
        <PersonalisedHome />
        <TrendingSongs compact />
        <NewReleases compact showFilters={false} limit={8} />
        <RecommendedPlaylists compact />
        <DeferredHomeFeaturedContent />
        <CatalogueTrustSections initialCounts={catalogueCounts} />
      </main>
    </PublicCatalogueProvider>
  );
}
