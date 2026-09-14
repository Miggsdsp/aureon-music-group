import CataloguePageClient from './CataloguePageClient';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecord, getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue, publicCatalogueRecord } from '@/lib/public-catalogue';

export const revalidate = 300;

export default async function CataloguePage() {
  const [artists, albums, songs] = await Promise.all([getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs')]);
  const catalogue = makePublicCatalogue({ artists, albums, songs });
  return <PublicCatalogueProvider catalogue={initialCatalogueFor(catalogue, 'music')}><CataloguePageClient /></PublicCatalogueProvider>;
}
