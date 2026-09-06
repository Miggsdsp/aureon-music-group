'use client';

import { useEffect } from 'react';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('audio') as HTMLAudioElement | null;
}

function mediaArtwork(source: string) {
  const raw = source || DEFAULT_ARTWORK;
  let absolute = '';
  try { absolute = new URL(raw, window.location.origin).href; }
  catch { absolute = new URL(DEFAULT_ARTWORK, window.location.origin).href; }
  return new URL(`/api/media/artwork?src=${encodeURIComponent(absolute)}`, window.location.origin).href;
}

export default function BackgroundPlaybackBridge() {
  const { currentSong, isPlaying, next, previous, seekTo } = useMusicPlayer();

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    if (!currentSong) {
      mediaSession.metadata = null;
      return;
    }
    const artwork = mediaArtwork(getArtwork(currentSong));
    try {
      mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || 'Aureon Music Group',
        artist: currentSong.artistName || currentSong.artist || 'Aureon Music Group',
        album: currentSong.album || 'Aureon Music Group',
        artwork: [
          { src: artwork, sizes: '512x512' },
          { src: artwork, sizes: '256x256' },
          { src: artwork, sizes: '128x128' },
          { src: artwork, sizes: '96x96' },
        ],
      });
    } catch {}
  }, [currentSong]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try { navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}
  }, [isPlaying]);

  useEffect(() => {
    const audio = getAudio();
    if (audio) {
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audio.setAttribute('x-webkit-airplay', 'allow');
    }
    if (!('mediaSession' in navigator)) return;

    const mediaSession = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler); } catch {}
    };

    setHandler('play', async () => {
      const activeAudio = getAudio();
      if (!activeAudio) return;
      try { await activeAudio.play(); } catch {}
    });
    setHandler('pause', () => getAudio()?.pause());

    // These are the standard AVRCP/MediaSession track actions consumed by
    // Bluetooth head units, CarPlay, Android Auto and lock-screen media UIs.
    setHandler('previoustrack', () => { void previous(); });
    setHandler('nexttrack', () => { void next(); });

    // Do NOT advertise +/-10-second actions. Registering these makes several
    // iOS/vehicle surfaces choose seek buttons instead of previous/next track.
    setHandler('seekbackward', null);
    setHandler('seekforward', null);

    // Timeline scrubbing can remain supported independently of skip buttons.
    setHandler('seekto', details => {
      if (details.seekTime == null) return;
      seekTo(details.seekTime);
    });

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', null);
    };
  }, [next, previous, seekTo]);

  return null;
}
