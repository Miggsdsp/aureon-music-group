'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Clock3, Play } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import styles from './ContinueListening.module.css';

type ContinueItem = {
  songId: string;
  title?: string;
  artist?: string;
  coverImageUrl?: string;
  progressSeconds?: number;
  durationSeconds?: number;
  progressPercent?: number;
  updatedAt?: string;
  expiresAt?: string;
};

const formatTime = (value: number) => Number.isFinite(value)
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  : '0:00';

export function ContinueListening({ compact = false }: { compact?: boolean }) {
  const { resumeSong } = useMusicPlayer();
  const [user, setUser] = useState<User | null>(null);
  const [item, setItem] = useState<ContinueItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) {
      setItem(null);
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch('/api/member/library', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json();
        if (!cancelled) setItem(response.ok ? data.continueListening || null : null);
      } catch {
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const refresh = () => void load();
    window.addEventListener('aureon-continue-listening-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('aureon-continue-listening-updated', refresh);
    };
  }, [user]);

  if (loading || !user || !item?.songId) return null;
  const duration = Math.max(0, Number(item.durationSeconds || 0));
  const position = Math.max(0, Math.min(Number(item.progressSeconds || 0), duration || Number(item.progressSeconds || 0)));
  const percentage = Math.max(0, Math.min(100, Number(item.progressPercent || (duration ? position / duration * 100 : 0))));
  const song: PlayerSong = {
    id: item.songId,
    title: item.title || 'Untitled track',
    artistName: item.artist || 'Aureon Music Group',
    coverImageUrl: item.coverImageUrl || '',
    duration,
  };

  return <section className={`${styles.section} ${compact ? styles.compact : ''}`} aria-labelledby="continue-listening-heading">
    <div className={styles.heading}>
      <div><p>Resume your journey</p><h2 id="continue-listening-heading">Continue Listening</h2></div>
      <Link href="/library">Open library →</Link>
    </div>
    <article className={styles.card}>
      <div className={styles.artwork}>
        {item.coverImageUrl ? <Image src={item.coverImageUrl} alt={`${item.title || 'Song'} artwork`} fill sizes={compact ? '96px' : '(max-width: 700px) 110px, 150px'} /> : <span>AUREON</span>}
      </div>
      <div className={styles.copy}>
        <p className={styles.artist}>{item.artist || 'Aureon Music Group'}</p>
        <h3>{item.title || 'Untitled track'}</h3>
        <div className={styles.progress} aria-label={`${Math.round(percentage)} percent listened`}><span style={{ width: `${percentage}%` }} /></div>
        <div className={styles.meta}><span><Clock3 size={14} /> {formatTime(position)} of {formatTime(duration)}</span><span>{Math.round(percentage)}% complete</span></div>
      </div>
      <button type="button" className={styles.resume} onClick={() => resumeSong(song, position)}><Play size={17} /> Resume</button>
    </article>
  </section>;
}
