'use client';

import { useEffect } from 'react';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('.aureon-global-player + audio, audio') as HTMLAudioElement | null;
}

function clickPlayerControl(label: string) {
  const button = document.querySelector(`.aureon-global-player button[aria-label="${label}"]`) as HTMLButtonElement | null;
  button?.click();
}

function mediaArtwork(source: string) {
  const raw = source || DEFAULT_ARTWORK;
  let absolute = '';
  try { absolute = new URL(raw, window.location.origin).href; }
  catch { absolute = new URL(DEFAULT_ARTWORK, window.location.origin).href; }
  return new URL(`/api/media/artwork?src=${encodeURIComponent(absolute)}`, window.location.origin).href;
}

export default function BackgroundPlaybackBridge() {
  const { currentSong, isPlaying } = useMusicPlayer();

  // Metadata is driven from the same React player state used by the visible
  // Aureon player. There is deliberately no second queue implementation here.
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
        album: 'Aureon Music Group',
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

  // Install media controls once. Reinstalling/clearing them every time playback
  // state changes can make car/lock-screen next/previous buttons disappear.
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
    setHandler('nexttrack', () => clickPlayerControl('Next'));
    setHandler('previoustrack', () => clickPlayerControl('Previous'));
    setHandler('seekto', details => {
      const activeAudio = getAudio();
      if (!activeAudio || details.seekTime == null || !Number.isFinite(activeAudio.duration)) return;
      activeAudio.currentTime = Math.min(Math.max(0, details.seekTime), activeAudio.duration);
    });

    // Do not register seekforward/seekbackward. Several car interfaces replace
    // previous/next with 10-second seek buttons when those handlers exist.
    setHandler('seekforward', null);
    setHandler('seekbackward', null);

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('nexttrack', null);
      setHandler('previoustrack', null);
      setHandler('seekto', null);
    };
  }, []);

  return null;
}
