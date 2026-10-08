type PreviewRecord = Record<string, any> | null | undefined;

function privatePreviewUrl(record: Record<string, any>, details: Record<string, unknown>) {
  const id = String(record.id || record.songId || '').trim();
  const privateFilePath = String(record.privateFilePath || details.privateFilePath || record.fullTrackPath || details.fullTrackPath || '').trim();
  if (!id || !privateFilePath.startsWith('private/full-tracks/')) return '';
  return `/api/preview/${encodeURIComponent(id)}`;
}

const PREVIEW_FIELDS = [
  'previewUrl',
  'previewAudioUrl',
  'audioPreviewUrl',
  'sampleUrl',
  'sampleAudioUrl',
  'clipUrl',
  'teaserUrl',
] as const;

function usable(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (
    text.startsWith('/') ||
    text.startsWith('http://') ||
    text.startsWith('https://') ||
    text.startsWith('data:') ||
    text.startsWith('blob:')
  ) return text;
  return '';
}

function fromObject(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  return usable(object.url || object.downloadURL || object.downloadUrl || object.src);
}

export function getPreviewUrl(record: PreviewRecord): string {
  if (!record) return '';
  const details = record.details && typeof record.details === 'object' ? record.details : {};
  const media = record.media && typeof record.media === 'object' ? record.media : {};
  // New uploads already include a public, pre-generated 40-second preview in
  // Firebase Storage. Prefer it over generating a WAV preview through Vercel
  // on every request; keep the private-master route for legacy catalogue items.
  for (const field of PREVIEW_FIELDS) {
    const direct = usable(record[field]) || fromObject(record[field]);
    if (direct) return direct;
    const nested = usable(details[field]) || fromObject(details[field]);
    if (nested) return nested;
    const mediaValue = usable(media[field]) || fromObject(media[field]);
    if (mediaValue) return mediaValue;
  }

  return privatePreviewUrl(record, details);
}
