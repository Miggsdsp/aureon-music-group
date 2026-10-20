export function isLogoArtwork(source: unknown): boolean {
  return /logo/i.test(String(source || ''));
}
