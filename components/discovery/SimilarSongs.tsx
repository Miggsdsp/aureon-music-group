'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Pause, Play, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { recommendSongs, type RecommendationEntity } from '@/lib/recommendations';
import { trackAnalytics } from '@/lib/track-analytics';
import styles from './SimilarSongs.module.css';

type SongRecord = RecommendationEntity & {
  id: string;
  title?: string;
  slug?: string;
  artistId?: string;
  artistName?: string;
  artistSlug?: string;
  coverImageUrl?: string;
  imageUrl?: string;
  previewUrl?: string;
  duration?: string;
  details?: Record<string, any>;
};

type Props = {
  currentSong: SongRecord;
  songs: SongRecord[];
};

const PREVIEW_SECONDS = 40;

function value(song: SongRecord, key: string) {
  return (song as Record<string, any>)[key] ?? song.details?.[key];
}

function SimilarSongCard({ song, confidence }: { song: SongRecord; confidence: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const preview = String(value(song, 'previewUrl') || '');
  const title = String(song.title || song.name || 'Untitled track');
  const artist = String(value(song, 'artistName') || value(song, 'artist') || 'Aureon Music Group');
  const artistSlug = String(value(song, 'artistSlug') || '');
  const artwork = String(value(song, 'coverImageUrl') || value(song, 'imageUrl') || '/images/branding/Aureon_Header_Logo.png');
  const duration = String(value(song, 'duration') || 'Preview');
  const href = `/songs/${song.slug || song.id}`;

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    audioRef.current?.pause();
  }, []);

  function recordStart(source: 'hover' | 'button') {
    trackAnalytics({
      eventType: 'song_play',
      entityType: 'song',
      entityId: song.id,
      title,
      artistId: String(song.artistId || value(song, 'artistId') || ''),
      artistName: artist,
      metadata: { recommendationSource: 'similar_songs', interaction: source },
    });
  }

  async function start(source: 'hover' | 'button') {
    const audio = audioRef.current;
    if (!audio || !preview) return;
    try {
      if (audio.currentTime >= PREVIEW_SECONDS) audio.currentTime = 0;
      await audio.play();
      setPlaying(true);
      recordStart(source);
    } catch {
      setPlaying(false);
    }
  }

  function stop(reset = false) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    if (reset) audio.currentTime = 0;
    setPlaying(false);
  }

  function enter() {
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches || !preview) return;
    hoverTimer.current = setTimeout(() => void start('hover'), 450);
  }

  function leave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    stop(true);
  }

  function timeUpdate() {
    const audio = audioRef.current;
    if (!audio || audio.currentTime < PREVIEW_SECONDS) return;
    audio.pause();
    audio.currentTime = PREVIEW_SECONDS;
    setPlaying(false);
    trackAnalytics({
      eventType: 'preview_complete',
      entityType: 'song',
      entityId: song.id,
      title,
      artistName: artist,
      listenedSeconds: PREVIEW_SECONDS,
      progressPercent: 100,
      metadata: { recommendationSource: 'similar_songs' },
    });
  }

  return (
    <article className={styles.card} onMouseEnter={enter} onMouseLeave={leave}>
      <Link className={styles.artworkLink} href={href} aria-label={`Open ${title}`}>
        <Image src={artwork} alt={`${title} artwork`} fill sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 25vw" loading="lazy" />
        {preview && <span className={styles.hoverState}><Sparkles size={13}/>{playing ? 'Preview playing' : 'Hover to preview'}</span>}
      </Link>
      <div className={styles.body}>
        <Link className={styles.title} href={href}>{title}</Link>
        {artistSlug ? <Link className={styles.artist} href={`/artists/${artistSlug}`}>{artist}</Link> : <span className={styles.artist}>{artist}</span>}
        <div className={styles.meta}><span>{duration}</span><span className={styles.confidence}>{Math.round(confidence * 100)}% match</span></div>
        <button className={styles.play} type="button" disabled={!preview} onClick={() => playing ? stop() : void start('button')}>
          {playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause preview' : preview ? 'Play preview' : 'Preview coming soon'}
        </button>
        {preview && <audio ref={audioRef} className={styles.audio} src={preview} preload="none" onTimeUpdate={timeUpdate} onEnded={() => setPlaying(false)} />}
      </div>
    </article>
  );
}

export function SimilarSongs({ currentSong, songs }: Props) {
  const recommendations = useMemo(
    () => recommendSongs(songs, { seed: currentSong, limit: 8, excludeIds: [currentSong.id] }),
    [currentSong, songs],
  );

  if (!recommendations.length) return null;

  return (
    <section className={styles.section} aria-labelledby="similar-songs-title">
      <div className={styles.heading}>
        <div><p>Keep discovering</p><h2 id="similar-songs-title">You May Also Like</h2></div>
        <span>Eight contextual recommendations ranked by genre, mood, tempo, energy and listener popularity.</span>
      </div>
      <div className={styles.grid}>
        {recommendations.map(({ item, confidence }) => <SimilarSongCard key={item.id || item.slug} song={item as SongRecord} confidence={confidence} />)}
      </div>
    </section>
  );
}
