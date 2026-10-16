import { ownsMediaSession } from './media-session-owner';

const DEFAULT_ARTWORK = '/images/branding/Aureon_Header_Logo.png';
type TrackMetadata = { title?: string; artist?: string; album?: string; artwork?: string };
type CachedMetadata = { key: string; metadata: MediaMetadata };
const cache = new WeakMap<HTMLAudioElement, CachedMetadata>();
const boundAudio = new WeakSet<HTMLAudioElement>();
let active: { audio: HTMLAudioElement; track: TrackMetadata } | null = null;
let lifecycleBound = false;

export function mediaArtwork(source?: string) {
  if (typeof window === 'undefined') return DEFAULT_ARTWORK;
  let absolute: string;
  try { absolute = new URL(source || DEFAULT_ARTWORK, window.location.origin).href; }
  catch { absolute = new URL(DEFAULT_ARTWORK, window.location.origin).href; }
  // Separate cache key from the legacy raw-image response.
  return new URL(`/api/media/artwork?format=jpeg&v=2&src=${encodeURIComponent(absolute)}`, window.location.origin).href;
}

export function publishMediaMetadata(audio: HTMLAudioElement, track: TrackMetadata, state: MediaSessionPlaybackState, force = false) {
  if (!ownsMediaSession(audio) || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  const title = track.title || 'Aureon Music Group';
  const artist = track.artist || 'Aureon Music Group';
  const album = track.album || 'Aureon Music Group';
  const artwork = mediaArtwork(track.artwork);
  const key = JSON.stringify([title, artist, album, artwork]);
  audio.title = `${title} — ${artist}`;
  active = { audio, track };
  try {
    let cached = cache.get(audio);
    const refreshNativeSnapshot = force || (state === 'playing' && session.playbackState !== 'playing');
    // Give WebKit a fresh object on playback transitions and explicit
    // lifecycle refreshes instead of relying on a same-object assignment to
    // signal a native Now Playing update.
    if (!cached || cached.key !== key || refreshNativeSnapshot) {
      // MediaMetadata.artwork is read-only after construction. Include it in
      // the initial object so Safari publishes text and cover in one update.
      let metadata: MediaMetadata;
      try {
        metadata = new MediaMetadata({ title, artist, album, artwork: [
          { src: artwork, sizes: '512x512', type: 'image/jpeg' },
          { src: artwork, sizes: '256x256', type: 'image/jpeg' },
          { src: artwork, sizes: '128x128', type: 'image/jpeg' },
          { src: artwork, sizes: '96x96', type: 'image/jpeg' },
        ] });
      } catch {
        audio.setAttribute('data-aureon-media-artwork-status', 'rejected');
        metadata = new MediaMetadata({ title, artist, album });
      }
      cached = { key, metadata };
      cache.set(audio, cached);
    }
    if (force || session.metadata !== cached.metadata) session.metadata = cached.metadata;
    session.playbackState = state;
    // Record the browser's readback, rather than just the requested props.
    audio.setAttribute('data-aureon-media-session-title', session.metadata?.title || '');
    audio.setAttribute('data-aureon-media-session-artist', session.metadata?.artist || '');
    audio.setAttribute('data-aureon-media-session-artwork', session.metadata?.artwork[0]?.src || '');
    audio.setAttribute('data-aureon-media-session-status', 'published');
  } catch (error) {
    audio.setAttribute('data-aureon-media-session-status', error instanceof Error ? error.name : 'failed');
  }
  const refresh = () => {
    if (!active || !ownsMediaSession(active.audio)) return;
    publishMediaMetadata(active.audio, active.track, active.audio.paused ? 'paused' : 'playing', true);
  };
  if (!boundAudio.has(audio)) {
    boundAudio.add(audio);
    for (const event of ['loadedmetadata', 'playing']) audio.addEventListener(event, () => {
      if (active?.audio === audio) refresh();
    });
  }
  if (!lifecycleBound) {
    lifecycleBound = true;
    window.addEventListener('pageshow', refresh);
    // iOS Safari can hand the active media session to the lock screen while
    // the page transitions to hidden. Re-publish at that boundary as well as
    // on resume; otherwise Now Playing can retain controls but lose metadata.
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pagehide', refresh);
  }
}
