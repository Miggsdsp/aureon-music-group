export const DEFAULT_ARTWORK = '/images/branding/Aureon_Header_Logo.png';

type ArtworkRecord = Record<string, any> | null | undefined;

const FIELDS = [
  'coverImageUrl','artworkUrl','imageUrl','image','coverUrl','cover','albumArtworkUrl','albumArtwork',
  'thumbnailUrl','featuredImageUrl','profileImageUrl','logoUrl','posterUrl','poster'
] as const;

function usable(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('/') || text.startsWith('http://') || text.startsWith('https://') || text.startsWith('data:') || text.startsWith('blob:')) return text;
  return '';
}

export function getArtwork(record: ArtworkRecord, fallback = DEFAULT_ARTWORK): string {
  if (!record) return fallback;
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  for (const field of FIELDS) {
    const direct = usable(record[field]);
    if (direct) return direct;
    const nested = usable(details[field]);
    if (nested) return nested;
  }
  return fallback;
}
