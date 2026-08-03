export type Artist = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  genre: string;
  latest: string;
  latestFile: string;
  desc: string;
  bio: string;
  sound: string[];
};

/**
 * Artist records are managed exclusively through the Aureon Control Center.
 *
 * Keeping a second hard-coded roster here caused deleted artists to continue
 * appearing in Songs and Albums relationship dropdowns after their Firestore
 * records had been removed. The live Firestore `artists` collection is now the
 * single source of truth for active artists.
 */
export const artists: Artist[] = [];

export function getArtistBySlug(slug: string) {
  return artists.find((artist) => artist.slug === slug);
}

export function getArtistAudioPath(artist: Artist) {
  return `/music/artists/${artist.slug}/${artist.latestFile}`;
}
