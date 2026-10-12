'use client';

import { useEffect, useRef } from 'react';
import { getArtwork } from '@/lib/get-artwork';
import { publishMediaMetadata } from '@/lib/media-session-metadata';
import { claimMediaSession, ownsMediaSession, releaseMediaSession } from '@/lib/media-session-owner';
import { useMusicPlayer } from './MusicPlayerProvider';

function getAudio() {
  return document.querySelector('audio[data-aureon-member-audio="true"]') as HTMLAudioElement | null;
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
      publishMediaMetadata(audio, {
        title: currentSong.title,
        artist: currentSong.artistName || currentSong.artist,
        artwork: getArtwork(currentSong),
      }, audio.paused ? 'paused' : 'playing');
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
