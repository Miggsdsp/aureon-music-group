import CataloguePageClient from './CataloguePageClient';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { buildMetadata, getPublishedRecords } from '@/lib/seo';
import { makePublicCatalogue } from '@/lib/public-catalogue';

export const metadata = buildMetadata({
  title: 'Aureon Artists | Discover Original Music',
  description: 'Meet the artists of Aureon Music Group. Explore original music, artist stories and published releases across the Aureon catalogue.',
  path: '/artists',
});

export const revalidate = 300;

export default async function CataloguePage() {
  const artists = await getPublishedRecords('artists');
  const catalogue = makePublicCatalogue({ artists });
  return <PublicCatalogueProvider catalogue={catalogue}><CataloguePageClient /></PublicCatalogueProvider>;
}
