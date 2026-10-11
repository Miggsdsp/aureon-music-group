// The document has one MediaSession, even when preview and member audio coexist.
let owner: HTMLAudioElement | null = null;

export function ownsMediaSession(audio: HTMLAudioElement | null) {
  return audio !== null && owner === audio;
}

export function claimMediaSession(audio: HTMLAudioElement) {
  owner = audio;
  // Set ownership before pause events so the old player cannot overwrite it.
  document.querySelectorAll<HTMLAudioElement>('audio[data-aureon-preview-audio="true"], audio[data-aureon-member-audio="true"]').forEach(other => {
    if (other !== audio && !other.paused) other.pause();
  });
}

export function releaseMediaSession(audio: HTMLAudioElement | null) {
  if (!ownsMediaSession(audio)) return;
  owner = null;
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  session.metadata = null;
  session.playbackState = 'none';
  for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]) {
    try { session.setActionHandler(action, null); } catch {}
  }
}
