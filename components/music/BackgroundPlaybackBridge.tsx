'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_ARTWORK, getArtwork } from '@/lib/get-artwork';
import { claimMediaSession, ownsMediaSession, releaseMediaSession } from '@/lib/media-session-owner';
import { useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('audio[data-aureon-member-audio="true"]') as HTMLAudioElement | null;
}

function mediaArtwork(source: string) {
  const raw = source || DEFAULT_ARTWORK;
  let absolute = '';
  try { absolute = new URL(raw, window.location.origin).href; }
  catch { absolute = new URL(DEFAULT_ARTWORK, window.location.origin).href; }
  return new URL(`/api/media/artwork?src=${encodeURIComponent(absolute)}`, window.location.origin).href;
}

export default function BackgroundPlaybackBridge() {
  const player = useMusicPlayer();
  const latest = useRef(player);
  latest.current = player;
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    if (!('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { mediaSession.setActionHandler(action, handler); } catch {}
    };
    const refresh = () => {
      const { currentSong } = latest.current;
      if (!ownsMediaSession(audio) || !currentSong) return;
      try {
        mediaSession.metadata = new MediaMetadata({
          title: currentSong.title || 'Aureon Music Group',
          artist: currentSong.artistName || currentSong.artist || 'Aureon Music Group',
          album: 'Aureon Music Group',
          artwork: [{ src: mediaArtwork(getArtwork(currentSong)), sizes: 'any' }],
        });
        mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
      } catch {}
      setHandler('play', () => { if (audio.paused) void latest.current.toggle(); });
      setHandler('pause', () => audio.pause());
      setHandler('previoustrack', () => { void latest.current.previous(); });
      setHandler('nexttrack', () => { void latest.current.next(); });
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', details => {
        if (details.seekTime != null) latest.current.seekTo(details.seekTime);
      });
    };
    const onPlay = () => { claimMediaSession(audio); refresh(); };
    const onPause = () => {
      if (ownsMediaSession(audio)) mediaSession.playbackState = 'paused';
    };
    refreshRef.current = refresh;
    audio.addEventListener('play', onPlay);
    audio.addEventListener('playing', refresh);
    audio.addEventListener('pause', onPause);
    refresh();
    return () => {
      refreshRef.current = null;
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', refresh);
      audio.removeEventListener('pause', onPause);
      releaseMediaSession(audio);
    };
  }, []);

  useEffect(() => { refreshRef.current?.(); }, [player.currentSong, player.isPlaying]);
  return null;
}
