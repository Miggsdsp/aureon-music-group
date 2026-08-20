'use client';

import { useEffect } from 'react';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('audio') as HTMLAudioElement | null;
}

function clickPlayerControl(label: string) {
  const button = document.querySelector(`.aureon-global-player button[aria-label="${label}"]`) as HTMLButtonElement | null;
  button?.click();
}

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
  const { currentSong, isPlaying } = useMusicPlayer();

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');

    if (!('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;
    let cancelled = false;

    if (currentSong) {
      const requestedArtwork = getArtwork(currentSong);
      void verifyArtwork(requestedArtwork).then(artwork => {
        if (cancelled) return;
        mediaSession.metadata = new MediaMetadata({
          title: currentSong.title || 'Aureon Music Group',
          artist: currentSong.artistName || currentSong.artist || 'Aureon Music Group',
          album: 'Aureon Music Group',
          artwork: [
            { src: artwork, sizes: '512x512' },
            { src: artwork, sizes: '256x256' },
            { src: artwork, sizes: '128x128' },
          ],
        });
      });
    } else {
      mediaSession.metadata = null;
    }

    try { mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler); } catch {}
    };

    setHandler('play', async () => {
      const activeAudio = getAudio();
      if (!activeAudio) return;
      try { await activeAudio.play(); } catch {}
    });

    setHandler('pause', () => {
      getAudio()?.pause();
    });

    setHandler('nexttrack', () => clickPlayerControl('Next'));
    setHandler('previoustrack', () => clickPlayerControl('Previous'));

    setHandler('seekto', details => {
      const activeAudio = getAudio();
      if (!activeAudio || details.seekTime == null || !Number.isFinite(activeAudio.duration)) return;
      activeAudio.currentTime = Math.min(Math.max(0, details.seekTime), activeAudio.duration);
    });

    setHandler('seekforward', details => {
      const activeAudio = getAudio();
      if (!activeAudio || !Number.isFinite(activeAudio.duration)) return;
      const offset = details.seekOffset ?? 10;
      activeAudio.currentTime = Math.min(activeAudio.duration, activeAudio.currentTime + offset);
    });

    setHandler('seekbackward', details => {
      const activeAudio = getAudio();
      if (!activeAudio) return;
      const offset = details.seekOffset ?? 10;
      activeAudio.currentTime = Math.max(0, activeAudio.currentTime - offset);
    });

    const updatePosition = () => {
      const activeAudio = getAudio();
      if (!activeAudio || !Number.isFinite(activeAudio.duration) || activeAudio.duration <= 0) return;
      try {
        mediaSession.setPositionState({
          duration: activeAudio.duration,
          playbackRate: activeAudio.playbackRate || 1,
          position: Math.min(activeAudio.currentTime, activeAudio.duration),
        });
      } catch {}
    };

    audio.addEventListener('timeupdate', updatePosition);
    audio.addEventListener('durationchange', updatePosition);
    audio.addEventListener('loadedmetadata', updatePosition);

    return () => {
      cancelled = true;
      audio.removeEventListener('timeupdate', updatePosition);
      audio.removeEventListener('durationchange', updatePosition);
      audio.removeEventListener('loadedmetadata', updatePosition);
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('nexttrack', null);
      setHandler('previoustrack', null);
      setHandler('seekto', null);
      setHandler('seekforward', null);
      setHandler('seekbackward', null);
    };
  }, [currentSong, isPlaying]);

  return null;
}
