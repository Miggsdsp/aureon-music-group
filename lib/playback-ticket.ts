import { createHmac, timingSafeEqual } from 'node:crypto';

const TICKET_VERSION = 'v1';
export const PLAYBACK_TICKET_TTL_SECONDS = 6 * 60 * 60;

function secret() {
  const value = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n') || process.env.FIREBASE_ADMIN_PROJECT_ID || '';
  if (!value) throw new Error('Playback ticket secret is unavailable.');
  return value;
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createPlaybackTicket(uid: string, songId: string, ttlSeconds = PLAYBACK_TICKET_TTL_SECONDS) {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, ttlSeconds);
  const payload = `${TICKET_VERSION}.${encodeURIComponent(uid)}.${encodeURIComponent(songId)}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyPlaybackTicket(ticket: string, expectedSongId: string) {
  const parts = String(ticket || '').split('.');
  if (parts.length !== 5 || parts[0] !== TICKET_VERSION) return null;

  const [version, encodedUid, encodedSongId, expiresValue, suppliedSignature] = parts;
  const payload = `${version}.${encodedUid}.${encodedSongId}.${expiresValue}`;
  const expectedSignature = sign(payload);
  const supplied = Buffer.from(suppliedSignature || '');
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  const expiresAt = Number(expiresValue);
  const uid = decodeURIComponent(encodedUid || '');
  const songId = decodeURIComponent(encodedSongId || '');
  if (!uid || songId !== expectedSongId || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  return { uid, songId, expiresAt };
}
