'use client';

import { useEffect, useRef } from 'react';
import { firebaseAuth } from '@/lib/firebase-client';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { type PlayerSong, useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('audio') as HTMLAudioElement | null;
}

function clickPlayerControl(label: string) {
  const button = document.querySelector(`.aureon-global-player button[aria-label="${label}"]`) as HTMLButtonElement | null;
  button?.click();
}

function mediaArtwork(source: string) {
  const raw = source || DEFAULT_ARTWORK;
  return new URL(`/api/media/artwork?src=${encodeURIComponent(raw)}`, window.location.origin).href;
}

function applyMetadata(mediaSession: MediaSession, song: PlayerSong | null) {
  if (!song) {
    mediaSession.metadata = null;
    return;
  }

  mediaSession.metadata = new MediaMetadata({
    title: song.title || 'Aureon Music Group',
    artist: song.artistName || song.artist || 'Aureon Music Group',
    album: 'Aureon Music Group',
    artwork: [{ src: mediaArtwork(getArtwork(song)) }],
  });
}

export default function BackgroundPlaybackBridge() {
  const { currentSong, queue, isPlaying, resumeSong } = useMusicPlayer();
  const streamCache = useRef<Map<string, string>>(new Map());
  const inflight = useRef<Map<string, Promise<string | null>>>(new Map());
  const activeIndex = useRef(-1);

  useEffect(() => {
    const providerIndex = currentSong ? queue.findIndex(song => song.id === currentSong.id) : -1;
    if (providerIndex >= 0) activeIndex.current = providerIndex;
  }, [currentSong, queue]);

  useEffect(() => {
    if (!queue.length || !firebaseAuth.currentUser) return;
    let cancelled = false;

    const primeSong = (song: PlayerSong) => {
      const cached = streamCache.current.get(song.id);
      if (cached) return Promise.resolve(cached);
      const existing = inflight.current.get(song.id);
      if (existing) return existing;

      const request = (async () => {
        try {
          const user = firebaseAuth.currentUser;
          if (!user) return null;
          const token = await user.getIdToken();
          const response = await fetch(`/api/member/stream/${encodeURIComponent(song.id)}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await response.json();
          if (!response.ok || !data?.url) return null;
          const url = String(data.url);
          if (!cancelled) streamCache.current.set(song.id, url);
          return url;
        } catch {
          return null;
        } finally {
          inflight.current.delete(song.id);
        }
      })();

      inflight.current.set(song.id, request);
      return request;
    };

    void Promise.allSettled(queue.map(primeSong));
    return () => { cancelled = true; };
  }, [queue]);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');

    if (!('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    applyMetadata(mediaSession, currentSong);
    try { mediaSession.playbackState = isPlaying ? 'playing' : 'paused'; } catch {}

    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler); } catch {}
    };

    const playCachedIndex = (targetIndex: number) => {
      const targetSong = queue[targetIndex];
      const activeAudio = getAudio();
      if (!targetSong || !activeAudio) return false;
      const url = streamCache.current.get(targetSong.id);
      if (!url) return false;

      activeIndex.current = targetIndex;
      activeAudio.src = url;
      activeAudio.currentTime = 0;
      activeAudio.load();
      applyMetadata(mediaSession, targetSong);
      try { mediaSession.playbackState = 'playing'; } catch {}
      void activeAudio.play().catch(() => {});
      return true;
    };

    const advance = (direction: 1 | -1) => {
      const activeAudio = getAudio();
      if (!activeAudio || !queue.length) return false;

      if (direction === -1 && activeAudio.currentTime > 4) {
        activeAudio.currentTime = 0;
        void activeAudio.play().catch(() => {});
        return true;
      }

      const targetIndex = activeIndex.current + direction;
      if (targetIndex < 0 || targetIndex >= queue.length) return false;
      return playCachedIndex(targetIndex);
    };

    setHandler('play', async () => {
      const activeAudio = getAudio();
      if (!activeAudio) return;
      try { await activeAudio.play(); } catch {}
    });
    setHandler('pause', () => getAudio()?.pause());
    setHandler('nexttrack', () => { if (!advance(1)) clickPlayerControl('Next'); });
    setHandler('previoustrack', () => { if (!advance(-1)) clickPlayerControl('Previous'); });

    setHandler('seekto', details => {
      const activeAudio = getAudio();
      if (!activeAudio || details.seekTime == null || !Number.isFinite(activeAudio.duration)) return;
      activeAudio.currentTime = Math.min(Math.max(0, details.seekTime), activeAudio.duration);
    });
    setHandler('seekforward', details => {
      const activeAudio = getAudio();
      if (!activeAudio || !Number.isFinite(activeAudio.duration)) return;
      activeAudio.currentTime = Math.min(activeAudio.duration, activeAudio.currentTime + (details.seekOffset ?? 10));
    });
    setHandler('seekbackward', details => {
      const activeAudio = getAudio();
      if (!activeAudio) return;
      activeAudio.currentTime = Math.max(0, activeAudio.currentTime - (details.seekOffset ?? 10));
    });

    const handleEnded = (event: Event) => {
      if (!advance(1)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

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

    const syncWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const providerIndex = currentSong ? queue.findIndex(song => song.id === currentSong.id) : -1;
      const backgroundIndex = activeIndex.current;
      if (backgroundIndex < 0 || backgroundIndex === providerIndex) return;
      const song = queue[backgroundIndex];
      const activeAudio = getAudio();
      if (!song || !activeAudio) return;
      const position = Number.isFinite(activeAudio.currentTime) ? activeAudio.currentTime : 0;
      void resumeSong(song, position, queue, backgroundIndex);
    };

    audio.addEventListener('ended', handleEnded, true);
    audio.addEventListener('timeupdate', updatePosition);
    audio.addEventListener('durationchange', updatePosition);
    audio.addEventListener('loadedmetadata', updatePosition);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      audio.removeEventListener('ended', handleEnded, true);
      audio.removeEventListener('timeupdate', updatePosition);
      audio.removeEventListener('durationchange', updatePosition);
      audio.removeEventListener('loadedmetadata', updatePosition);
      document.removeEventListener('visibilitychange', syncWhenVisible);
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('nexttrack', null);
      setHandler('previoustrack', null);
      setHandler('seekto', null);
      setHandler('seekforward', null);
      setHandler('seekbackward', null);
    };
  }, [currentSong, isPlaying, queue, resumeSong]);

  return null;
}
