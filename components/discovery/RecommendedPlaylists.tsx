'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Clock3, ListMusic, Play, Sparkles } from 'lucide-react';
import { ArtworkImage } from '@/components/ArtworkImage';
import { useMusicPlayer, type PlayerSong } from '@/components/music/MusicPlayerProvider';
import { firebaseAuth } from '@/lib/firebase-client';
import { getArtwork } from '@/lib/get-artwork';
import { recommendPlaylists, type ListeningSignal } from '@/lib/recommendations';
import { trackAnalytics } from '@/lib/track-analytics';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import styles from './RecommendedPlaylists.module.css';

type SongRecord = PublicRecord & {
  title?: string;
  slug?: string;
  artist?: string;
  artistName?: string;
  artistId?: string;
  artistSlug?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  energy?: number | string;
  duration?: number;
  coverImageUrl?: string;
  imageUrl?: string;
  previewUrl?: string;
  playCount?: number;
  recentPlays?: number;
  details?: Record<string, any>;
};

type RecentRecord = {
  songId?: string;
  artist?: string;
  playCount?: number;
  progressPercent?: number;
  playedAt?: string;
};

type MemberSignals = {
  favouriteSongIds: string[];
  favouriteArtists: string[];
  recentlyPlayed: RecentRecord[];
};

type PlaylistTemplate = {
  id: string;
  name: string;
  description: string;
  genres: string[];
  moods: string[];
  energy: 'low' | 'medium' | 'high' | 'any';
  hours?: number[];
};

type GeneratedPlaylist = PlaylistTemplate & {
  tracks: SongRecord[];
  confidence: number;
  reason: string;
};

const TEMPLATES: PlaylistTemplate[] = [
  { id: 'late-night-drive', name: 'Late Night Drive', description: 'Cinematic songs for the road after dark.', genres: ['deep house', 'house', 'modern pop', 'latin pop'], moods: ['night', 'cinematic', 'hypnotic', 'moody'], energy: 'medium', hours: [21,22,23,0,1,2,3] },
  { id: 'country-roads', name: 'Country Roads', description: 'Modern country stories, open roads and real heart.', genres: ['country', 'country pop', 'americana'], moods: ['uplifting', 'nostalgic', 'heartfelt'], energy: 'medium' },
  { id: 'workout', name: 'Workout', description: 'High-energy Aureon tracks built to keep you moving.', genres: ['afrobeats', 'house', 'deep house', 'pop', 'latin pop'], moods: ['energetic', 'powerful', 'euphoric'], energy: 'high', hours: [6,7,8,9,16,17,18,19] },
  { id: 'relax', name: 'Relax', description: 'A calm, premium mix for slowing everything down.', genres: ['reggae', 'deep house', 'acoustic', 'pop'], moods: ['calm', 'relaxed', 'warm', 'peaceful'], energy: 'low', hours: [19,20,21,22,23] },
  { id: 'focus', name: 'Focus', description: 'Steady, unobtrusive music for deep concentration.', genres: ['deep house', 'house', 'instrumental', 'pop'], moods: ['focused', 'hypnotic', 'calm'], energy: 'medium', hours: [8,9,10,11,12,13,14,15,16] },
  { id: 'deep-house-essentials', name: 'Deep House Essentials', description: 'Sophisticated, hypnotic house from the Aureon catalogue.', genres: ['deep house', 'house', 'dance'], moods: ['cinematic', 'hypnotic', 'euphoric'], energy: 'medium' },
  { id: 'sunday-morning', name: 'Sunday Morning', description: 'Warm songs for a slower and brighter start.', genres: ['reggae', 'acoustic', 'country pop', 'pop'], moods: ['warm', 'hopeful', 'peaceful', 'uplifting'], energy: 'low', hours: [7,8,9,10,11,12] },
  { id: 'road-trip', name: 'Road Trip', description: 'Big hooks and open-road energy across Aureon genres.', genres: ['country pop', 'modern pop', 'latin pop', 'afrobeats', 'reggae'], moods: ['uplifting', 'adventurous', 'energetic'], energy: 'high' },
  { id: 'acoustic-evenings', name: 'Acoustic Evenings', description: 'Intimate storytelling and organic instrumentation.', genres: ['acoustic', 'country', 'country pop', 'reggae'], moods: ['intimate', 'heartfelt', 'warm'], energy: 'low', hours: [18,19,20,21,22] },
];

const MOODS = ['Automatic', 'Energetic', 'Relaxed', 'Focused', 'Romantic', 'Reflective'];
const normalise = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const list = (input: unknown): string[] => Array.isArray(input)
  ? input.flatMap((item): string[] => list(item))
  : String(input || '').split(/[,/|;]+/).map(normalise).filter(Boolean);
const value = (song: SongRecord, keys: string[]) => { const details = song.details || {}; for (const key of keys) { const result = song[key] ?? details[key]; if (result !== undefined && result !== null && result !== '') return result; } return ''; };
const intersects = (a: string[], b: string[]) => a.some(item => b.some(target => item.includes(target) || target.includes(item)));

function energyValue(song: SongRecord) {
  const raw = value(song, ['energy', 'energyLevel', 'intensity']);
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && String(raw).trim()) return numeric > 1 ? Math.min(1, numeric / 100) : numeric;
  const label = normalise(raw);
  if (['high','energetic','intense','powerful'].some(item => label.includes(item))) return .85;
  if (['low','calm','soft','gentle'].some(item => label.includes(item))) return .25;
  return .55;
}

function moodForHour(hour: number) {
  if (hour >= 22 || hour < 5) return 'Reflective';
  if (hour < 10) return 'Focused';
  if (hour >= 17 && hour < 21) return 'Energetic';
  return 'Automatic';
}

function moodTerms(selected: string) {
  const map: Record<string, string[]> = {
    Energetic: ['energetic','powerful','euphoric','uplifting','workout'],
    Relaxed: ['relaxed','calm','peaceful','warm','soft'],
    Focused: ['focused','hypnotic','steady','instrumental','calm'],
    Romantic: ['romantic','intimate','heartfelt','warm','love'],
    Reflective: ['reflective','nostalgic','moody','cinematic','heartfelt'],
  };
  return map[selected] || [];
}

function durationLabel(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)} min`;
}

export function RecommendedPlaylists({ compact = false, memberOnly = false }: { compact?: boolean; memberOnly?: boolean }) {
  const { items: songs } = usePublishedCollection<SongRecord>('songs', []);
  const { playQueue } = useMusicPlayer();
  const [signals, setSignals] = useState<MemberSignals>({ favouriteSongIds: [], favouriteArtists: [], recentlyPlayed: [] });
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [selectedMood, setSelectedMood] = useState('Automatic');

  useEffect(() => {
    const saved = localStorage.getItem('aureon-current-mood');
    if (saved && MOODS.includes(saved)) setSelectedMood(saved);
    return onAuthStateChanged(firebaseAuth, async user => {
      setSignedIn(Boolean(user));
      setAuthReady(true);
      if (!user) return setSignals({ favouriteSongIds: [], favouriteArtists: [], recentlyPlayed: [] });
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/member/library', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json();
        if (response.ok) setSignals({
          favouriteSongIds: Array.isArray(data.favouriteSongIds) ? data.favouriteSongIds.map(String) : [],
          favouriteArtists: Array.isArray(data.favouriteArtists) ? data.favouriteArtists.map(String) : [],
          recentlyPlayed: Array.isArray(data.recentlyPlayed) ? data.recentlyPlayed : [],
        });
      } catch {}
    });
  }, []);

  const playlists = useMemo<GeneratedPlaylist[]>(() => {
    if (!songs.length) return [];
    const now = new Date();
    const hour = now.getHours();
    const effectiveMood = selectedMood === 'Automatic' ? moodForHour(hour) : selectedMood;
    const recentMap = new Map(signals.recentlyPlayed.map((item, index) => [String(item.songId || ''), Math.max(1, 100 - index)]));
    const favourites = new Set(signals.favouriteSongIds.map(String));
    const favouriteArtists = new Set(signals.favouriteArtists.map(normalise));
    const history: ListeningSignal[] = signals.recentlyPlayed.map(item => {
      const song = songs.find(candidate => candidate.id === item.songId);
      return {
        entityId: item.songId,
        entityType: 'song',
        artistId: String(value(song || {} as SongRecord, ['artistId','artistName','artist']) || item.artist || ''),
        genre: String(value(song || {} as SongRecord, ['genre','primaryGenre']) || ''),
        mood: String(value(song || {} as SongRecord, ['mood','vibe']) || ''),
        playCount: Number(item.playCount || 1),
        progressPercent: Number(item.progressPercent || 0),
        playedAt: item.playedAt,
      };
    });
    const templateEntities = TEMPLATES.map(template => ({ ...template, title: template.name, genre: template.genres, mood: template.moods, energy: template.energy }));
    const rankedTemplates = recommendPlaylists(templateEntities, {
      listeningHistory: history,
      favouriteIds: signals.favouriteSongIds,
      now,
      limit: TEMPLATES.length,
    });
    return rankedTemplates.map(result => {
      const template = result.item as PlaylistTemplate;
      const chosenMoodTerms = moodTerms(effectiveMood);
      const rankedSongs = songs.map(song => {
        const genres = list(value(song, ['genre','genres','primaryGenre','subgenre','style']));
        const moods = list(value(song, ['mood','moods','vibe','description']));
        const artist = normalise(value(song, ['artistId','artistName','artist']));
        let score = 0;
        if (intersects(genres, template.genres.map(normalise))) score += 35;
        if (intersects(moods, template.moods.map(normalise))) score += 28;
        if (chosenMoodTerms.length && intersects(moods, chosenMoodTerms)) score += 18;
        if (template.hours?.includes(hour)) score += 12;
        const energy = energyValue(song);
        if (template.energy === 'high') score += energy * 15;
        else if (template.energy === 'low') score += (1 - energy) * 15;
        else if (template.energy === 'medium') score += (1 - Math.abs(.55 - energy)) * 12;
        if (favourites.has(String(song.id))) score += 24;
        if (favouriteArtists.has(artist)) score += 16;
        score += Math.min(14, (recentMap.get(String(song.id)) || 0) / 8);
        score += Math.min(8, Number(value(song, ['recentPlays','plays7d','playCount']) || 0) / 100);
        return { song, score };
      }).sort((a, b) => b.score - a.score);
      let tracks = rankedSongs.filter(item => item.score > 3).slice(0, 12).map(item => item.song);
      if (tracks.length < 5) tracks = rankedSongs.slice(0, 8).map(item => item.song);
      const personalSignals = signals.recentlyPlayed.length || signals.favouriteSongIds.length || signals.favouriteArtists.length;
      const timeMatch = template.hours?.includes(hour);
      const reason = personalSignals ? 'Based on your listening' : timeMatch ? `Made for ${hour >= 18 ? 'tonight' : 'right now'}` : `Curated for ${effectiveMood.toLowerCase()} listening`;
      return { ...template, tracks, confidence: Math.max(result.confidence, tracks.length ? .45 : 0), reason };
    }).filter(item => item.tracks.length).slice(0, compact ? 6 : 9);
  }, [compact, selectedMood, signals, songs]);

  function setMood(mood: string) {
    setSelectedMood(mood);
    localStorage.setItem('aureon-current-mood', mood);
  }

  async function play(playlist: GeneratedPlaylist) {
    if (!signedIn) {
      window.location.href = `/account?mode=register&next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const queue: PlayerSong[] = playlist.tracks.map(song => ({
      id: String(song.id),
      title: song.title || 'Untitled track',
      artistName: String(value(song, ['artistName','artist']) || 'Aureon Music Group'),
      genre: String(value(song, ['genre','primaryGenre']) || ''),
      coverImageUrl: getArtwork(song),
      duration: Number(value(song, ['duration','durationSeconds']) || 0),
    }));
    trackAnalytics({ eventType: 'playlist_played', entityType: 'playlist', entityId: playlist.id, playlistId: playlist.id, playlistName: playlist.name, metadata: { source: window.location.pathname, generated: true, mood: selectedMood, trackCount: queue.length } });
    await playQueue(queue, 0);
  }

  if (memberOnly && authReady && !signedIn) return null;
  if (!playlists.length) return null;

  return <section className={`${styles.section} ${compact ? styles.compact : ''}`} aria-labelledby="recommended-playlists-heading">
    <div className={styles.heading}>
      <div><p><Sparkles size={14}/> Personalised for the moment</p><h2 id="recommended-playlists-heading">Recommended Playlists</h2></div>
      {!compact && <Link href="/discover">Discover more →</Link>}
    </div>
    <div className={styles.moods} aria-label="Current mood">
      <span>Current mood</span>{MOODS.map(mood => <button key={mood} type="button" className={selectedMood === mood ? styles.active : ''} onClick={() => setMood(mood)}>{mood}</button>)}
    </div>
    <div className={styles.grid}>
      {playlists.map(playlist => {
        const lead = playlist.tracks[0];
        const totalDuration = playlist.tracks.reduce((sum, song) => sum + Number(value(song, ['duration','durationSeconds']) || 0), 0);
        return <article className={styles.card} key={playlist.id}>
          <div className={styles.artwork}>
            <ArtworkImage src={getArtwork(lead)} alt={`${playlist.name} playlist artwork`} fill sizes={compact ? '(max-width:700px) 76vw, 240px' : '(max-width:700px) 90vw, (max-width:1100px) 45vw, 30vw'} />
            <span className={styles.badge}><ListMusic size={14}/> Aureon Mix</span>
            <button type="button" className={styles.play} onClick={() => void play(playlist)} aria-label={`Play ${playlist.name}`}><Play fill="currentColor"/></button>
          </div>
          <div className={styles.copy}>
            <p className={styles.reason}>{playlist.reason}</p>
            <h3>{playlist.name}</h3>
            <p>{playlist.description}</p>
            <div className={styles.meta}><span>{playlist.tracks.length} tracks</span><span><Clock3 size={13}/>{totalDuration ? durationLabel(totalDuration) : 'Aureon mix'}</span></div>
            <button type="button" className={styles.playButton} onClick={() => void play(playlist)}><Play size={14}/> {signedIn ? 'Play mix' : 'Create account to play'}</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
