import CataloguePageClient from './CataloguePageClient';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecord, getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue, publicCatalogueRecord } from '@/lib/public-catalogue';
import { notFound } from 'next/navigation';

export default async function CataloguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await getPublishedRecord('artists', slug);
  if (!record) notFound();
  const [artists, albums, songs, videos] = await Promise.all([getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs'), getPublishedRecords('videos')]);
  const catalogue = makePublicCatalogue({ artists, albums, songs, videos });
  const initial = publicCatalogueRecord(record, true);
  const related = catalogue.artists.find(item => item.id === initial.id);
  if (related) Object.assign(initial, { artistSlug: related.artistSlug || initial.artistSlug, albumSlug: related.albumSlug || initial.albumSlug });
  catalogue.artists = catalogue.artists.map(item => item.id === initial.id ? initial : item);
  return <PublicCatalogueProvider catalogue={initialCatalogueFor(catalogue, 'artists', initial)}><CataloguePageClient /></PublicCatalogueProvider>;
}
