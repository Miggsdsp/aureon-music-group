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
