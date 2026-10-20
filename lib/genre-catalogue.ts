import { getArtwork } from '@/lib/get-artwork';
import { matchesAlbum, matchesArtist, publicAsset } from '@/lib/public-catalogue';
import { isPublicContent } from '@/lib/public-content';
import { canonicalGenreSlug, getControlledGenres } from '@/lib/public-genres';

export type GenreCatalogueCard = {
  slug: string;
  label: string;
  description: string;
  trackCount: number;
  artwork: string;
};

function genreValues(record: Record<string, any>): string[] {
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  return ['genre', 'primaryGenre', 'genres', 'subgenre'].flatMap(key => {
    const value = record[key] ?? details[key];
    return (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean);
  });
}

/** Build counts and representative images only from eligible published catalogue records. */
export function buildGenreCatalogue(
  songs: Array<Record<string, any>>,
  albums: Array<Record<string, any>> = [],
  artists: Array<Record<string, any>> = [],
): GenreCatalogueCard[] {
  const controlled = getControlledGenres();
  const known = new Map(controlled.map(genre => [genre.slug, genre]));
  const trackIds = new Map(controlled.map(genre => [genre.slug, new Set<string>()]));
  const artwork = new Map<string, string>();

  for (const song of songs) {
    if (!isPublicContent(song)) continue;
    const id = String(song.id || song.slug || '');
    if (!id) continue;
    const matchedGenres = new Set(genreValues(song).map(canonicalGenreSlug).filter((slug): slug is string => Boolean(slug && known.has(slug))));
    for (const slug of matchedGenres) {
      trackIds.get(slug)?.add(id);
      if (artwork.has(slug)) continue;
      let image = publicAsset(getArtwork(song, ''));
      if (!image) {
        const album = albums.find(candidate => isPublicContent(candidate) && matchesAlbum(song, candidate));
        if (album) image = publicAsset(getArtwork(album, ''));
      }
      if (!image) {
        const artist = artists.find(candidate => isPublicContent(candidate) && matchesArtist(song, candidate));
        if (artist) image = publicAsset(artist.profileImageUrl || artist.image || artist.logoUrl || getArtwork(artist, ''));
      }
      if (image) artwork.set(slug, image);
    }
  }

  return controlled.flatMap(genre => {
    const trackCount = trackIds.get(genre.slug)?.size || 0;
    return trackCount ? [{
      slug: genre.slug,
      label: genre.label,
      description: genre.description,
      trackCount,
      artwork: artwork.get(genre.slug) || '',
    }] : [];
  });
}
