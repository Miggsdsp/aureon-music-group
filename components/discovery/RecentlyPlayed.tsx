'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Clock3, History, Play } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import styles from './RecentlyPlayed.module.css';

type RecentlyPlayedItem = {
  id: string;
  songId?: string;
  title?: string;
  artist?: string;
  coverImageUrl?: string;
  progressSeconds?: number;
  durationSeconds?: number;
  playedAt?: string;
  playCount?: number;
};

const formatTime = (value: number) => Number.isFinite(value) && value > 0
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  : '0:00';

function lastListenedLabel(value?: string) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function RecentlyPlayed() {
  const { playSong } = useMusicPlayer();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<RecentlyPlayedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) {
      setItems([]);
      setLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch('/api/member/library', {
          headers: { authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await response.json();
        if (!cancelled) setItems(response.ok && Array.isArray(data.recentlyPlayed) ? data.recentlyPlayed.slice(0, 100) : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const refresh = () => void load();
    window.addEventListener('aureon-continue-listening-updated', refresh);
    window.addEventListener('aureon-recently-played-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('aureon-continue-listening-updated', refresh);
      window.removeEventListener('aureon-recently-played-updated', refresh);
    };
  }, [user]);

  const playable = useMemo(() => items.filter(item => item.songId || item.id), [items]);
  if (loading || !user || !playable.length) return null;

  return <section className={styles.section} aria-labelledby="recently-played-heading">
    <div className={styles.heading}>
      <div><p><History size={15} /> Your listening history</p><h2 id="recently-played-heading">Recently Played</h2></div>
      <Link href="/library">Open library →</Link>
    </div>
    <div className={styles.grid}>
      {playable.map(item => {
        const id = item.songId || item.id;
        const song: PlayerSong = {
          id,
          title: item.title || 'Untitled track',
          artistName: item.artist || 'Aureon Music Group',
          coverImageUrl: item.coverImageUrl || '',
          duration: Number(item.durationSeconds || 0),
        };
        return <article className={styles.card} key={id}>
          <div className={styles.artwork}>
            {item.coverImageUrl ? <Image src={item.coverImageUrl} alt={`${item.title || 'Song'} artwork`} fill sizes="(max-width: 700px) 72px, 86px" /> : <span>A</span>}
          </div>
          <div className={styles.copy}>
            <h3>{item.title || 'Untitled track'}</h3>
            <p>{item.artist || 'Aureon Music Group'}</p>
            <div className={styles.meta}>
              <span><Clock3 size={13} /> Played {formatTime(Number(item.progressSeconds || 0))}</span>
              <span>{lastListenedLabel(item.playedAt)}</span>
            </div>
          </div>
          <button type="button" className={styles.play} onClick={() => playSong(song)} aria-label={`Replay ${item.title || 'song'}`}><Play size={16} /> Replay</button>
        </article>;
      })}
    </div>
  </section>;
}
