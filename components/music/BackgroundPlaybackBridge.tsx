'use client';

import { useEffect } from 'react';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { useMusicPlayer } from './MusicPlayerProvider';

function absoluteArtwork(source: string) {
  try { return new URL(source || DEFAULT_ARTWORK, window.location.origin).href; }
  catch { return new URL(DEFAULT_ARTWORK, window.location.origin).href; }
}

function verifyArtwork(source: string) {
  const candidate = absoluteArtwork(source);
  const fallback = absoluteArtwork(DEFAULT_ARTWORK);
  return new Promise<string>(resolve => {
    const image = new window.Image();
    image.onload = () => resolve(candidate);
    image.onerror = () => resolve(fallback);
    image.src = candidate;
  });
}

export default function BackgroundPlaybackBridge() {
  const { currentSong, isPlaying, play, pause, next, previous, seekTo, seekBy, getPlaybackState } = useMusicPlayer();

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    let cancelled = false;

    if (currentSong) {
      void verifyArtwork(getArtwork(currentSong)).then(artwork => {
        if (cancelled) return;
        mediaSession.metadata = new MediaMetadata({
          title: currentSong.title || 'Aureon Music Group',
          artist: currentSong.artistName || currentSong.artist || 'Aureon Music Group',
          album: 'Aureon Music Group',
          artwork: [{ src: artwork, sizes: '512x512' }, { src: artwork, sizes: '256x256' }, { src: artwork, sizes: '128x128' }],
        });
      });
    } else mediaSession.metadata = null;

    try { mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => { try { mediaSession.setActionHandler(action, handler); } catch {} };
    setHandler('play', () => { void play(); });
    setHandler('pause', pause);
    setHandler('nexttrack', () => { void next(); });
    setHandler('previoustrack', () => { void previous(); });
    setHandler('seekto', details => { if (details.seekTime != null) seekTo(details.seekTime); });
    setHandler('seekforward', details => seekBy(details.seekOffset ?? 10));
    setHandler('seekbackward', details => seekBy(-(details.seekOffset ?? 10)));

    const updatePosition = () => {
      const state = getPlaybackState();
      if (!Number.isFinite(state.duration) || state.duration <= 0) return;
      try { mediaSession.setPositionState({ duration: state.duration, playbackRate: state.playbackRate || 1, position: Math.min(Math.max(0, state.position), state.duration) }); } catch {}
    };
    updatePosition();
    const timer = window.setInterval(updatePosition, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      setHandler('play', null); setHandler('pause', null); setHandler('nexttrack', null); setHandler('previoustrack', null);
      setHandler('seekto', null); setHandler('seekforward', null); setHandler('seekbackward', null);
    };
  }, [currentSong, getPlaybackState, isPlaying, next, pause, play, previous, seekBy, seekTo]);

  return null;
}
