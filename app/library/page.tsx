'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Pause, Play, Repeat2, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import styles from './library.module.css';

type Song = {
  id: string;
  title?: string;
  artistName?: string;
  artist?: string;
  genre?: string;
  coverImageUrl?: string;
  imageUrl?: string;
};

type Playlist = { id: string; name?: string; songIds?: string[] };
type Member = { subscriptionStatus?: string; plan?: string };

const formatTime = (value: number) => Number.isFinite(value)
  ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  : '0:00';

export default function LibraryPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const autoplayRef = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [playOrder, setPlayOrder] = useState<string[]>([]);
  const [orderIndex, setOrderIndex] = useState(-1);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) {
      setMember(null);
      setAccessChecked(true);
    }
  }), []);

  useEffect(() => {
    if (!user) {
      setMember(null);
      setAccessChecked(true);
      return;
    }
    setAccessChecked(false);
    return onSnapshot(doc(firestore, 'members', user.uid), snapshot => {
      setMember(snapshot.exists() ? snapshot.data() as Member : null);
      setAccessChecked(true);
    }, () => {
      setMember(null);
      setAccessChecked(true);
    });
  }, [user]);

  const membershipStatus = String(member?.subscriptionStatus || 'inactive').toLowerCase();
  const hasAccess = membershipStatus === 'active' || membershipStatus === 'trialing';

  useEffect(() => {
    if (!user || !accessChecked || !hasAccess) {
      setSongs([]);
      return;
    }

    const publishedSongs = query(collection(firestore, 'songs'), where('status', '==', 'published'));
    return onSnapshot(publishedSongs, snapshot => {
      const catalogue = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Song));
      setSongs(catalogue);
      setMessage(current => current.includes('catalogue') || current.includes('library could not') ? '' : current);
    }, error => {
      console.error('Member catalogue listener failed', error);
      setSongs([]);
      setMessage('The published music catalogue could not be loaded. Please refresh the page.');
    });
  }, [user, accessChecked, hasAccess]);

  useEffect(() => {
    if (!user || !accessChecked || !hasAccess) {
      setPlaylists([]);
      return;
    }
    return onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snapshot => {
      setPlaylists(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Playlist)));
    }, error => {
      console.error('Playlist listener failed', error);
      setPlaylists([]);
      setMessage('Your playlists could not be loaded. Please refresh the page.');
    });
  }, [user, accessChecked, hasAccess]);

  useEffect(() => {
    if (hasAccess) return;
    audioRef.current?.pause();
    setAudioUrl('');
    setPlayingId('');
    setPlayOrder([]);
    setOrderIndex(-1);
    setIsPlaying(false);
  }, [hasAccess]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.pause();
    audio.muted = false;
    audio.volume = Math.max(0.01, volume || 1);
    audio.src = audioUrl;
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    const start = async () => {
      if (!autoplayRef.current) return;
      autoplayRef.current = false;
      try {
        await audio.play();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? `Playback was blocked: ${error.message}. Press Play again.` : 'Playback was blocked. Press Play again.');
      }
    };

    audio.addEventListener('canplay', start, { once: true });
    return () => audio.removeEventListener('canplay', start);
  }, [audioUrl, volume]);

  const songById = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const playingSong = songById.get(playingId);

  async function memberRequest(path: string, method = 'GET') {
    if (!user) {
      window.location.href = '/account';
      return null;
    }
    if (!hasAccess) throw new Error('Your paid membership is not active.');
    const token = await user.getIdToken();
    const response = await fetch(path, { method, headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function loadSong(song: Song, order: string[] = playOrder, index = -1) {
    setMessage('');
    setBusy(`play-${song.id}`);
    autoplayRef.current = true;
    try {
      const data = await memberRequest(`/api/member/stream/${song.id}`);
      if (!data?.url) throw new Error('No playable audio URL was returned.');
      setPlayingId(song.id);
      setPlayOrder(order.length ? order : [song.id]);
      setOrderIndex(index >= 0 ? index : Math.max(0, order.indexOf(song.id)));
      setAudioUrl(String(data.url));
    } catch (error) {
      autoplayRef.current = false;
      setMessage(error instanceof Error ? error.message : 'Unable to play this song.');
    } finally {
      setBusy('');
    }
  }

  async function playPlaylist(playlist: Playlist) {
    let ids = (playlist.songIds || []).filter(id => songById.has(id));
    if (!ids.length) return setMessage('This playlist has no available songs yet.');
    if (shuffle) ids = [...ids].sort(() => Math.random() - 0.5);
    const first = songById.get(ids[0]);
    if (first) await loadSong(first, ids, 0);
  }

  async function goTo(index: number) {
    if (!playOrder.length) return;
    let next = index;
    if (next < 0) next = repeat ? playOrder.length - 1 : 0;
    if (next >= playOrder.length) next = repeat ? 0 : playOrder.length - 1;
    const song = songById.get(playOrder[next]);
    if (song) await loadSong(song, playOrder, next);
  }

  async function nextTrack() {
    if (shuffle && playOrder.length > 1) {
      let next = orderIndex;
      while (next === orderIndex) next = Math.floor(Math.random() * playOrder.length);
      await goTo(next);
      return;
    }
    if (orderIndex < playOrder.length - 1 || repeat) await goTo(orderIndex + 1);
    else audioRef.current?.pause();
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to play audio.');
    }
  }

  async function download(song: Song) {
    setBusy(`download-${song.id}`);
    try {
      const data = await memberRequest(`/api/member/download/${song.id}`, 'POST');
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download this song.');
    } finally {
      setBusy('');
    }
  }

  async function addToPlaylist(song: Song) {
    if (!user || !hasAccess) return setMessage('An active membership is required to change playlists.');
    const playlistId = selectedPlaylists[song.id];
    if (!playlistId) return setMessage('Choose a playlist first.');
    try {
      await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), {
        songIds: arrayUnion(song.id),
        updatedAt: serverTimestamp(),
      });
      const playlist = playlists.find(item => item.id === playlistId);
      setMessage(`${song.title || 'Song'} added to ${playlist?.name || 'your playlist'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add this song to the playlist.');
    }
  }

  async function removeFromPlaylist(playlistId: string, songId: string) {
    if (!user || !hasAccess) return;
    try {
      await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), {
        songIds: arrayRemove(songId),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove this song.');
    }
  }

  return <main className={styles.shell}>
    <div className={styles.topbar}><Link href="/account">← Member dashboard</Link><Link href="/">Return to website</Link></div>
    <section className={styles.hero}><p className={styles.kicker}>Member Library</p><h1>Your music. Your way.</h1><p>Stream full tracks, use your monthly downloads and build personal playlists from every published Aureon release.</p></section>
    {message && <p className={styles.message}>{message}</p>}
    {user && accessChecked && !hasAccess && <p className={styles.message}>Your paid membership is no longer active. <Link href="/account">Open your dashboard to renew or choose a plan.</Link></p>}

    {audioUrl && hasAccess && <section className={styles.player}>
      <audio ref={audioRef} preload="auto" playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(event.currentTarget.duration)} onEnded={nextTrack} />
      <div className={styles.nowPlaying}>{(playingSong?.coverImageUrl || playingSong?.imageUrl) ? <img src={playingSong.coverImageUrl || playingSong.imageUrl} alt="" /> : <div className={styles.coverPlaceholder} />}<div><span>Now playing</span><strong>{playingSong?.title || 'Aureon track'}</strong><small>{playingSong?.artistName || playingSong?.artist || 'Aureon Music Group'}</small></div></div>
      <div className={styles.transport}><div className={styles.transportButtons}><button onClick={() => setShuffle(value => !value)}><Shuffle size={19} /></button><button onClick={() => goTo(orderIndex - 1)}><SkipBack size={22} /></button><button className={styles.playButton} onClick={togglePlay}>{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button><button onClick={nextTrack}><SkipForward size={22} /></button><button onClick={() => setRepeat(value => !value)}><Repeat2 size={19} /></button></div><div className={styles.timeline}><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} onChange={event => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} /><span>{formatTime(duration)}</span></div></div>
      <div className={styles.volume}><button onClick={() => { const next = !muted; setMuted(next); if (audioRef.current) audioRef.current.muted = next; }}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume} onChange={event => { const next = Number(event.target.value); setVolume(next); setMuted(next === 0); if (audioRef.current) { audioRef.current.volume = next; audioRef.current.muted = next === 0; } }} /></div>
    </section>}

    {hasAccess && <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Personal collection</p><h2>Your playlists</h2></div><p>Create and rename playlists from your dashboard.</p></div>
        {playlists.length ? <div className={styles.playlistGrid}>{playlists.map(playlist => {
          const playlistSongs = (playlist.songIds || []).map(id => songById.get(id)).filter(Boolean) as Song[];
          return <article className={styles.playlistCard} key={playlist.id}><p className={styles.kicker}>Playlist</p><h3>{playlist.name || 'Untitled playlist'}</h3><p className={styles.playlistMeta}>{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</p><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!playlistSongs.length || Boolean(busy)} onClick={() => playPlaylist(playlist)}>Play playlist</button></div>{playlistSongs.length ? <div className={styles.playlistSongs}>{playlistSongs.map((song, index) => <div className={styles.playlistSong} key={song.id}><button className={styles.songInfo} onClick={() => loadSong(song, playlistSongs.map(item => item.id), index)}><strong>{song.title || 'Untitled track'}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></button><button className={styles.remove} onClick={() => removeFromPlaylist(playlist.id, song.id)}>Remove</button></div>)}</div> : <p className={styles.empty}>Add songs from the catalogue below.</p>}</article>;
        })}</div> : <p className={styles.message}>You have no playlists yet. Create one in your <Link href="/account">member dashboard</Link>.</p>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Full catalogue</p><h2>Published releases</h2></div><p>{songs.length} tracks available</p></div>
        <div className={styles.catalogue}>{songs.map(song => <article className={styles.songCard} key={song.id}>{(song.coverImageUrl || song.imageUrl) && <img src={song.coverImageUrl || song.imageUrl} alt={`${song.title || 'Song'} cover`} />}<div className={styles.songBody}><h3>{song.title || 'Untitled track'}</h3><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.genre ? ` · ${song.genre}` : ''}</p><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={Boolean(busy)} onClick={() => loadSong(song, [song.id], 0)}>{busy === `play-${song.id}` ? 'Loading…' : 'Play full track'}</button><button className={styles.button} disabled={Boolean(busy)} onClick={() => download(song)}>{busy === `download-${song.id}` ? 'Preparing…' : 'Download'}</button>{playlists.length > 0 && <><select className={styles.select} value={selectedPlaylists[song.id] || ''} onChange={event => setSelectedPlaylists(current => ({ ...current, [song.id]: event.target.value }))}><option value="">Choose playlist</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select><button className={styles.button} onClick={() => addToPlaylist(song)}>Add to playlist</button></>}</div></div></article>)}</div>
      </section>
    </>}
  </main>;
}
