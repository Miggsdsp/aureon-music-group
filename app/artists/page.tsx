import CataloguePageClient from './CataloguePageClient';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecord, getPublishedRecords } from '@/lib/seo';
import { makePublicCatalogue, publicCatalogueRecord } from '@/lib/public-catalogue';

export const revalidate = 300;

export default async function CataloguePage() {
  const artists = await getPublishedRecords('artists');
  const catalogue = makePublicCatalogue({ artists });
  return <PublicCatalogueProvider catalogue={catalogue}><CataloguePageClient /></PublicCatalogueProvider>;
}
