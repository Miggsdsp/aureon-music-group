import { recommendSongs } from './recommendations';
import { contentDate, isPublicContent, normalizePublicRecord } from './public-content';
import { getArtwork } from './get-artwork';
import { getPreviewUrl } from './get-preview-url';

export type CatalogueRecord = Record<string, any> & { id: string };
export type PublicCatalogue = Record<string, CatalogueRecord[]>;
const displayFields = ['id', 'slug', 'status', 'title', 'name', 'artistId', 'artistSlug', 'artistName', 'artist', 'artistCode', 'albumId', 'albumSlug', 'albumTitle', 'genre', 'genres', 'primaryGenre', 'year', 'releaseType', 'type', 'format', 'edition', 'albumType', 'trackNumber', 'trackCount', 'songCount', 'duration', 'price', 'promotional', 'purchasable', 'mood', 'bpm', 'energy', 'style', 'sound', 'instrumentation', 'instruments', 'playCount', 'recentPlays', 'plays30d', 'monthlyPlays', 'listenerCrossover', 'similarArtistIds', 'tags', 'shortForm'] as const;
const dates = ['releaseDate', 'publishedAt', 'publishDate', 'createdAt', 'updatedAt', 'publishAt', 'scheduledAt'] as const;

/** Never send complete Firestore documents (masters, streams or storage credentials) to RSC clients. */
export function publicAsset(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { return ''; }
  if (/private\/|full-tracks\/|\/api\/(?:download|member)\//i.test(decoded)) return '';
  return /^(?:https?:\/\/|\/(?!\/))/.test(value) ? value : '';
}

export function publicCatalogueRecord(raw: Record<string, any>, fullText = false): CatalogueRecord {
  const record = normalizePublicRecord(raw, raw.id);
  const result: CatalogueRecord = { id: String(raw.id), status: 'published' };
  for (const key of displayFields) {
    const value = record[key];
    if (['string', 'number', 'boolean'].includes(typeof value)) result[key] = value;
    else if (Array.isArray(value)) result[key] = value.filter(item => ['string', 'number'].includes(typeof item));
  }
  result.slug = String(result.slug || result.id);
  for (const key of dates) {
    const date = contentDate(record[key]);
    if (date) result[key] = date.toISOString();
  }
  const artwork = publicAsset(getArtwork(record));
  if (artwork) result.coverImageUrl = artwork;
  for (const key of ['profileImageUrl', 'logoUrl', 'image']) {
    const url = publicAsset(String(record[key] || ''));
    if (url) result[key] = url;
  }
  const preview = publicAsset(getPreviewUrl(record));
  if (preview) result.previewUrl = preview;
  for (const key of ['externalUrl', 'youtubeUrl', 'vimeoUrl', 'thumbnailUrl']) {
    const url = publicAsset(String(record[key] || ''));
    if (url) result[key] = url;
  }
  if (fullText) for (const key of ['description', 'bio', 'story']) {
    if (typeof record[key] === 'string') result[key] = record[key];
  }
  return result;
}

const norm = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function matchesArtist(record: Record<string, any>, artist: Record<string, any>): boolean {
  const keys = [artist.id, artist.slug, artist.name, artist.title, artist.artistCode].map(norm).filter(Boolean);
  return [record.artistId, record.artistSlug, record.artistName, record.artist].map(norm).filter(Boolean).some(key => keys.includes(key));
}
export function matchesAlbum(song: Record<string, any>, album: Record<string, any>): boolean {
  return Boolean((song.albumId && song.albumId === album.id) || (song.albumSlug && norm(song.albumSlug) === norm(album.slug)) || (song.albumTitle && norm(song.albumTitle) === norm(album.title)));
}

export function makePublicCatalogue(collections: Record<string, Record<string, any>[]>): PublicCatalogue {
  const result: PublicCatalogue = {};
  for (const [name, records] of Object.entries(collections)) {
    result[name] = records.filter(record => isPublicContent(record)).map(record => publicCatalogueRecord(record, name !== 'songs'));
  }
  for (const record of [...(result.songs || []), ...(result.albums || []), ...(result.videos || [])]) {
    const artist = result.artists?.find(candidate => matchesArtist(record, candidate));
    if (artist) record.artistSlug = artist.slug;
    const album = result.albums?.find(candidate => matchesAlbum(record, candidate));
    if (album && result.songs?.includes(record)) record.albumSlug = album.slug;
  }
  return result;
}

/** Keep only the records needed by each initial view; live subscriptions load the full catalogue. */
export function initialCatalogueFor(catalogue: PublicCatalogue, view: 'artists' | 'songs' | 'albums' | 'music' | 'discover', record?: CatalogueRecord): PublicCatalogue {
  const songs = catalogue.songs || [];
  const result = { ...catalogue };
  const leads = (catalogue.albums || []).flatMap(album => {
    const lead = songs.filter(song => matchesAlbum(song, album)).sort((a,b) => Number(a.trackNumber ?? 999) - Number(b.trackNumber ?? 999)).find(song => song.previewUrl);
    return lead ? [lead] : [];
  });
  if (view === 'artists' && record) {
    result.songs = songs.map(song => matchesArtist(song, record) ? song : Object.fromEntries(Object.entries(song).filter(([key]) => ['id','status','slug','title','name','artistId','artistSlug','artistName','genre','releaseDate','publishedAt','recentPlays','plays30d','monthlyPlays'].includes(key))) as CatalogueRecord);
  } else if (view === 'songs' && record) {
    const selected = new Set([record.id, ...recommendSongs(songs, { seed:record, limit:8, excludeIds:[record.id] }).map(({item}) => item.id)]);
    result.songs = songs.filter(song => selected.has(song.id));
  } else if (view === 'albums' && record) {
    const selected = new Set([...songs.filter(song => matchesAlbum(song, record)), ...leads].map(song => song.id));
    result.songs = songs.filter(song => selected.has(song.id));
  } else if (view === 'music') {
    result.songs = songs.map((song,index) => index < 6 || !song.albumId && !song.albumSlug ? song : { id:song.id, status:song.status, slug:song.slug, albumId:song.albumId || '', albumSlug:song.albumSlug || '' });
  } else if (view === 'discover') {
    const date = (song: CatalogueRecord) => contentDate(song.releaseDate || song.publishedAt || song.publishDate || song.createdAt || song.year)?.getTime() || 0;
    const selected = new Set([...songs].sort((a,b) => date(b)-date(a)).slice(0,16).concat(leads).map(song => song.id));
    result.songs = songs.filter(song => selected.has(song.id));
  }
  return result;
}
