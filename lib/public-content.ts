import { canonicalArtistIdentity, canonicalArtistName, canonicalArtistSlug } from '@/lib/artist-identity';

type ContentRecord = Record<string, any>;

/** Accept Firestore timestamps and stored ISO dates without inventing a date. */
export function contentDate(value: any): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  try {
    const date = value instanceof Date ? value
      : typeof value?.toDate === 'function' ? value.toDate()
      : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000)
      : typeof value?._seconds === 'number' ? new Date(value._seconds * 1000)
      : new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}

/** Public SEO documents, never download/stream entitlements or member data. */
export function isPublicContent(record: ContentRecord, now = Date.now()): boolean {
  if (record.status !== 'published') return false;
  for (const fields of [record, record.details || {}]) {
    if (fields.isPublic === false || fields.isPrivate === true) return false;
    if (fields.visibility && fields.visibility !== 'public') return false;
    for (const key of ['publishAt', 'scheduledAt', 'releaseDate']) {
      const value = fields[key];
      if (value === undefined || value === null || value === '') continue;
      const date = contentDate(value);
      if (!date || date.getTime() > now) return false;
    }
  }
  return true;
}

export function contentLastModified(record: ContentRecord): Date | undefined {
  for (const key of ['updatedAt', 'publishedAt', 'publishAt', 'releaseDate', 'publishDate', 'createdAt']) {
    const date = contentDate(record[key]) || contentDate(record.details?.[key]);
    if (date && date.getTime() <= Date.now()) return date;
  }
  return undefined;
}

/** Top-level values are authoritative; legacy nested details provide missing values only. */
export function normalizePublicRecord(record: ContentRecord, id = record.id): ContentRecord {
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  const merged: ContentRecord = { ...details, ...record, id };
  for (const [key, value] of Object.entries(details)) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') merged[key] = value;
  }
  for (const key of ['releaseDate', 'publishedAt', 'publishDate', 'createdAt', 'updatedAt', 'publishAt', 'scheduledAt']) {
    const date = contentDate(merged[key]);
    if (date) merged[key] = date.toISOString();
  }
  // Legacy consumers still read details. Keep both views consistent, including false and zero.
  merged.details = { ...details };
  for (const key of Object.keys(details)) merged.details[key] = merged[key];
  merged.id = id;
  // Slug queries use the top-level field; missing slugs resolve through the real document ID.
  merged.slug = typeof record.slug === 'string' && record.slug.trim() ? record.slug.trim() : String(id || '');
  if ('slug' in details) merged.details.slug = merged.slug;

  // Canonicalise only the six confirmed Aureon artist identities. Stored document IDs remain untouched.
  const identity = canonicalArtistIdentity(merged);
  if (identity) {
    const looksLikeArtistRecord = Boolean(
      canonicalArtistSlug(merged.slug) === identity.slug &&
      (canonicalArtistName(merged.name) === identity.name || canonicalArtistName(merged.title) === identity.name)
    );

    if (looksLikeArtistRecord) {
      merged.name = identity.name;
      if (merged.title && canonicalArtistName(merged.title) === identity.name) merged.title = identity.name;
      merged.slug = identity.slug;
      if ('name' in merged.details) merged.details.name = identity.name;
      if ('title' in merged.details && canonicalArtistName(merged.details.title) === identity.name) merged.details.title = identity.name;
      if ('slug' in merged.details) merged.details.slug = identity.slug;
    }

    for (const key of ['artistName', 'artist']) {
      if (merged[key]) merged[key] = canonicalArtistName(merged[key]);
      if (merged.details?.[key]) merged.details[key] = canonicalArtistName(merged.details[key]);
    }
    if (merged.artistSlug) merged.artistSlug = canonicalArtistSlug(merged.artistSlug);
    if (merged.details?.artistSlug) merged.details.artistSlug = canonicalArtistSlug(merged.details.artistSlug);
  }
  return merged;
}
