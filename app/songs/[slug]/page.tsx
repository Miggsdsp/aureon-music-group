import CataloguePageClient from './CataloguePageClient';
import { PublicCatalogueProvider } from '@/components/catalogue/PublicCatalogueProvider';
import { getPublishedRecord, getPublishedRecords } from '@/lib/seo';
import { initialCatalogueFor, makePublicCatalogue, publicCatalogueRecord } from '@/lib/public-catalogue';
import { notFound } from 'next/navigation';
import {AnalyticsView} from '@/components/AnalyticsView';

export default async function CataloguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const record = await getPublishedRecord('songs', slug);
  if (!record) notFound();
  const [artists, albums, songs] = await Promise.all([getPublishedRecords('artists'), getPublishedRecords('albums'), getPublishedRecords('songs')]);
  const catalogue = makePublicCatalogue({ artists, albums, songs });
  const initial = publicCatalogueRecord(record, true);
  const related = catalogue.songs.find(item => item.id === initial.id);
  if (related) Object.assign(initial, { artistSlug: related.artistSlug || initial.artistSlug, albumSlug: related.albumSlug || initial.albumSlug });
  catalogue.songs = catalogue.songs.map(item => item.id === initial.id ? initial : item);
  return <PublicCatalogueProvider catalogue={initialCatalogueFor(catalogue, 'songs', initial)}><AnalyticsView event={{eventType:'song_view',entityType:'song',entityId:initial.id,slug:initial.slug,title:initial.title||initial.name,genre:initial.genre,artistId:initial.artistId,artistSlug:initial.artistSlug,artistName:initial.artistName||initial.artist,albumId:initial.albumId,albumSlug:initial.albumSlug,albumTitle:initial.albumTitle}}/><CataloguePageClient /></PublicCatalogueProvider>;
}
