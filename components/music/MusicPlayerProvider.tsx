'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ListMusic, Pause, Play, Repeat1, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import './music-player.css';

export type PlayerSong = {
  id: string;
  title?: string;
  artistName?: string;
  artist?: string;
  genre?: string;
  coverImageUrl?: string;
  imageUrl?: string;
  duration?: number;
  releaseYear?: number | string;
};

type RepeatMode = 'off' | 'one' | 'all';
type PlayerContextValue = {
  currentSong: PlayerSong | null;
  queue: PlayerSong[];
  isPlaying: boolean;
  playSong: (song: PlayerSong, queue?: PlayerSong[], index?: number) => Promise<void>;
  resumeSong: (song: PlayerSong, positionSeconds: number, queue?: PlayerSong[], index?: number) => Promise<void>;
  playQueue: (songs: PlayerSong[], index?: number) => Promise<void>;
  enqueue: (song: PlayerSong) => void;
  enqueueMany: (songs: PlayerSong[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const STORAGE_KEY = 'aureon-player-v1';
const formatTime = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}` : '0:00';

export function useMusicPlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('useMusicPlayer must be used inside MusicPlayerProvider.');
  return value;
}

export default function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoplay = useRef(false);
  const pendingSeek = useRef(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [index, setIndex] = useState(-1);
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [queueOpen, setQueueOpen] = useState(false);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const currentSong = index >= 0 ? queue[index] || null : null;

  const resetPlayer = useCallback((removeSavedState = false) => {
    shouldAutoplay.current = false;
    pendingSeek.current = 0;
    if (progressTimer.current) clearInterval(progressTimer.current);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setQueue([]);
    setIndex(-1);
    setAudioUrl('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueueOpen(false);
    setError('');
    if (removeSavedState && typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => onAuthStateChanged(firebaseAuth, user => {
    if (!user) {
      resetPlayer(true);
      setAuthReady(true);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        if (Array.isArray(saved.queue)) setQueue(saved.queue);
        if (Number.isInteger(saved.index)) setIndex(saved.index);
        if (typeof saved.volume === 'number') setVolume(saved.volume);
        if (typeof saved.muted === 'boolean') setMuted(saved.muted);
        if (typeof saved.shuffle === 'boolean') setShuffle(saved.shuffle);
        if (['off', 'one', 'all'].includes(saved.repeatMode)) setRepeatMode(saved.repeatMode);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setAuthReady(true);
  }), [resetPlayer]);

  useEffect(() => {
    if (!authReady || !firebaseAuth.currentUser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, index, volume, muted, shuffle, repeatMode }));
  }, [authReady, queue, index, volume, muted, shuffle, repeatMode]);

  useEffect(() => {
    document.body.classList.toggle('aureon-player-visible', Boolean(currentSong));
    return () => document.body.classList.remove('aureon-player-visible');
  }, [currentSong]);

  const memberActivity = useCallback(async (action: 'played' | 'progress', song: PlayerSong, progressSeconds = 0, durationSeconds = 0) => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/member/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          songId: song.id,
          title: song.title || '',
          artist: song.artistName || song.artist || '',
          coverImageUrl: song.coverImageUrl || song.imageUrl || '',
          progressSeconds,
          durationSeconds,
        }),
      });
      if (response.ok && typeof window !== 'undefined') window.dispatchEvent(new Event('aureon-continue-listening-updated'));
    } catch {}
  }, []);

  const fetchStream = useCallback(async (song: PlayerSong) => {
    const user = firebaseAuth.currentUser;
    if (!user) throw new Error('Sign in to play full tracks.');
    const token = await user.getIdToken();
    const response = await fetch(`/api/member/stream/${song.id}`, { headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok || !data?.url) throw new Error(data.error || 'The track could not be loaded.');
    return String(data.url);
  }, []);

  const loadAt = useCallback(async (nextIndex: number, nextQueue = queue, startSeconds = 0) => {
    const song = nextQueue[nextIndex];
    if (!song) return;
    setError('');
    shouldAutoplay.current = true;
    pendingSeek.current = Math.max(0, Number(startSeconds || 0));
    try {
      const url = await fetchStream(song);
      setQueue(nextQueue);
      setIndex(nextIndex);
      setAudioUrl(url);
      void memberActivity('played', song, pendingSeek.current, Number(song.duration || 0));
    } catch (err) {
      shouldAutoplay.current = false;
      pendingSeek.current = 0;
      setError(err instanceof Error ? err.message : 'Unable to play this track.');
    }
  }, [fetchStream, memberActivity, queue]);

  const playSong = useCallback(async (song: PlayerSong, nextQueue?: PlayerSong[], nextIndex?: number) => {
    const targetQueue = nextQueue?.length ? nextQueue : [song];
    const targetIndex = nextIndex ?? Math.max(0, targetQueue.findIndex(item => item.id === song.id));
    await loadAt(targetIndex, targetQueue, 0);
  }, [loadAt]);

  const resumeSong = useCallback(async (song: PlayerSong, positionSeconds: number, nextQueue?: PlayerSong[], nextIndex?: number) => {
    const targetQueue = nextQueue?.length ? nextQueue : [song];
    const targetIndex = nextIndex ?? Math.max(0, targetQueue.findIndex(item => item.id === song.id));
    await loadAt(targetIndex, targetQueue, positionSeconds);
  }, [loadAt]);

  const playQueue = useCallback(async (songs: PlayerSong[], startIndex = 0) => {
    if (!songs.length) return;
    await loadAt(startIndex, songs, 0);
  }, [loadAt]);

  const next = useCallback(async () => {
    if (!queue.length) return;
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      return;
    }
    if (shuffle && queue.length > 1) {
      let nextIndex = index;
      while (nextIndex === index) nextIndex = Math.floor(Math.random() * queue.length);
      await loadAt(nextIndex);
      return;
    }
    if (index < queue.length - 1) await loadAt(index + 1);
    else if (repeatMode === 'all') await loadAt(0);
    else setIsPlaying(false);
  }, [index, loadAt, queue, repeatMode, shuffle]);

  const previous = useCallback(async () => {
    if (audioRef.current && audioRef.current.currentTime > 4) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (index > 0) await loadAt(index - 1);
    else if (repeatMode === 'all' && queue.length) await loadAt(queue.length - 1);
  }, [index, loadAt, queue.length, repeatMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.pause();
    audio.src = audioUrl;
    audio.volume = volume;
    audio.muted = muted;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    const start = async () => {
      if (pendingSeek.current > 0 && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(pendingSeek.current, Math.max(0, audio.duration - 1));
        setCurrentTime(audio.currentTime);
      }
      pendingSeek.current = 0;
      if (!shouldAutoplay.current) return;
      shouldAutoplay.current = false;
      try { await audio.play(); } catch { setError('Playback was blocked. Press Play to continue.'); }
    };
    audio.addEventListener('loadedmetadata', start, { once: true });
    return () => audio.removeEventListener('loadedmetadata', start);
  }, [audioUrl, muted, volume]);

  useEffect(() => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (!isPlaying || !currentSong) return;
    progressTimer.current = setInterval(() => {
      const audio = audioRef.current;
      if (audio && currentSong) void memberActivity('progress', currentSong, audio.currentTime, audio.duration || 0);
    }, 15000);
    return () => { if (progressTimer.current) clearInterval(progressTimer.current); };
  }, [currentSong, isPlaying, memberActivity]);

  useEffect(() => {
    const saveBeforeLeave = () => {
      const audio = audioRef.current;
      if (audio && currentSong && audio.currentTime > 0) void memberActivity('progress', currentSong, audio.currentTime, audio.duration || 0);
    };
    window.addEventListener('pagehide', saveBeforeLeave);
    return () => window.removeEventListener('pagehide', saveBeforeLeave);
  }, [currentSong, memberActivity]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.src && currentSong) return playSong(currentSong, queue, index);
    try { if (audio.paused) await audio.play(); else audio.pause(); } catch { setError('Unable to control playback.'); }
  };

  const enqueue = (song: PlayerSong) => setQueue(current => current.some(item => item.id === song.id) ? current : [...current, song]);
  const enqueueMany = (songs: PlayerSong[]) => setQueue(current => [...current, ...songs.filter(song => !current.some(item => item.id === song.id))]);
  const removeFromQueue = (removeIndex: number) => setQueue(current => current.filter((_, itemIndex) => itemIndex !== removeIndex));
  const clearQueue = () => resetPlayer(true);

  const value = useMemo(() => ({ currentSong, queue, isPlaying, playSong, resumeSong, playQueue, enqueue, enqueueMany, removeFromQueue, clearQueue }), [currentSong, isPlaying, playQueue, playSong, queue, resetPlayer, resumeSong]);

  return <PlayerContext.Provider value={value}>
    {children}
    {currentSong && <div className="aureon-player-spacer" aria-hidden="true" />}
    <audio ref={audioRef} preload="auto" playsInline onPlay={() => setIsPlaying(true)} onPause={event => { setIsPlaying(false); if (currentSong && event.currentTarget.currentTime > 0) void memberActivity('progress', currentSong, event.currentTarget.currentTime, event.currentTarget.duration || 0); }} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(event.currentTarget.duration)} onEnded={next} />
    {currentSong && <aside className="aureon-global-player" aria-label="Music player">
      <button className="aureon-player-close" type="button" onClick={() => resetPlayer(true)} aria-label="Close music player"><X /></button>
      {error && <div className="aureon-player-error">{error}</div>}
      <div className="aureon-player-track">
        {(currentSong.coverImageUrl || currentSong.imageUrl) ? <img src={currentSong.coverImageUrl || currentSong.imageUrl} alt="" /> : <div className="aureon-player-cover" />}
        <div><strong>{currentSong.title || 'Untitled track'}</strong><span>{currentSong.artistName || currentSong.artist || 'Aureon Music Group'}</span></div>
      </div>
      <div className="aureon-player-main">
        <div className="aureon-player-controls">
          <button className={shuffle ? 'active' : ''} onClick={() => setShuffle(value => !value)} aria-label="Shuffle"><Shuffle /></button>
          <button onClick={previous} aria-label="Previous"><SkipBack /></button>
          <button className="primary" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause /> : <Play />}</button>
          <button onClick={next} aria-label="Next"><SkipForward /></button>
          <button className={repeatMode !== 'off' ? 'active' : ''} onClick={() => setRepeatMode(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off')} aria-label="Repeat">{repeatMode === 'one' ? <Repeat1 /> : <Repeat2 />}</button>
        </div>
        <div className="aureon-player-progress"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><span>{formatTime(duration)}</span></div>
      </div>
      <div className="aureon-player-side">
        <button onClick={() => setQueueOpen(value => !value)} aria-label="Queue"><ListMusic /></button>
        <button onClick={() => { const nextMuted = !muted; setMuted(nextMuted); if (audioRef.current) audioRef.current.muted = nextMuted; }} aria-label="Mute">{muted ? <VolumeX /> : <Volume2 />}</button>
        <input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={event => { const nextVolume = Number(event.target.value); setVolume(nextVolume); setMuted(nextVolume === 0); if (audioRef.current) { audioRef.current.volume = nextVolume; audioRef.current.muted = nextVolume === 0; } }} />
      </div>
      {queueOpen && <div className="aureon-queue-panel"><div className="aureon-queue-head"><strong>Up next</strong><button onClick={() => setQueueOpen(false)} aria-label="Close queue"><X /></button></div>{queue.map((song, itemIndex) => <button className={itemIndex === index ? 'current' : ''} key={`${song.id}-${itemIndex}`} onClick={() => loadAt(itemIndex)}><span>{itemIndex + 1}</span><div><strong>{song.title || 'Untitled track'}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></div><span onClick={event => { event.stopPropagation(); removeFromQueue(itemIndex); }}>×</span></button>)}<button className="aureon-clear-queue" onClick={clearQueue}>Clear queue</button></div>}
    </aside>}
  </PlayerContext.Provider>;
}
