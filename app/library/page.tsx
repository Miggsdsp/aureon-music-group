'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import styles from './library.module.css';

type Song = { id: string; title?: string; artistName?: string; artist?: string; genre?: string; coverImageUrl?: string; imageUrl?: string; status?: string };
type Playlist = { id: string; name?: string; songIds?: string[] };

export default function LibraryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Record<string, string>>({});
  const [playingId, setPlayingId] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => onSnapshot(collection(firestore, 'songs'), snapshot => setSongs(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Song)).filter(song => song.status === 'published'))), []);
  useEffect(() => {
    if (!user) { setPlaylists([]); return; }
    return onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snapshot => setPlaylists(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Playlist))));
  }, [user]);

  const songById = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const playingSong = songById.get(playingId);

  async function memberRequest(path: string, method = 'GET') {
    if (!user) { window.location.href = '/account'; return null; }
    const token = await user.getIdToken();
    const response = await fetch(path, { method, headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function playSong(song: Song, remainingQueue: string[] = []) {
    setMessage('');
    setBusy(`play-${song.id}`);
    try {
      const data = await memberRequest(`/api/member/stream/${song.id}`);
      if (!data) return;
      setPlayingId(song.id);
      setAudioUrl(data.url);
      setQueue(remainingQueue);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to play this song.');
    } finally { setBusy(''); }
  }

  async function playPlaylist(playlist: Playlist) {
    const ids = (playlist.songIds || []).filter(id => songById.has(id));
    if (!ids.length) { setMessage('This playlist has no available songs yet.'); return; }
    const first = songById.get(ids[0]);
    if (first) await playSong(first, ids.slice(1));
  }

  async function playNext() {
    if (!queue.length) return;
    const [nextId, ...rest] = queue;
    const nextSong = songById.get(nextId);
    if (nextSong) await playSong(nextSong, rest);
  }

  async function download(song: Song) {
    setMessage('');
    setBusy(`download-${song.id}`);
    try {
      const data = await memberRequest(`/api/member/download/${song.id}`, 'POST');
      if (data) window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download this song.');
    } finally { setBusy(''); }
  }

  async function addToPlaylist(song: Song) {
    if (!user) { window.location.href = '/account'; return; }
    const playlistId = selectedPlaylists[song.id];
    if (!playlistId) { setMessage('Choose a playlist first.'); return; }
    try {
      await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), { songIds: arrayUnion(song.id), updatedAt: serverTimestamp() });
      const playlist = playlists.find(item => item.id === playlistId);
      setMessage(`${song.title || 'Song'} added to ${playlist?.name || 'your playlist'}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add this song to the playlist.'); }
  }

  async function removeFromPlaylist(playlistId: string, songId: string) {
    if (!user) return;
    await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), { songIds: arrayRemove(songId), updatedAt: serverTimestamp() });
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topbar}><Link href="/account">← Member dashboard</Link><Link href="/">Return to website</Link></div>
      <section className={styles.hero}><p className={styles.kicker}>Member Library</p><h1>Your music. Your way.</h1><p>Stream full tracks, use your monthly downloads and build personal playlists from every published Aureon release.</p></section>
      {message && <p className={styles.message}>{message}</p>}
      {audioUrl && <section className={styles.player}><div><span>Now playing</span><strong>{playingSong?.title || 'Aureon track'}</strong><span>{playingSong?.artistName || playingSong?.artist || 'Aureon Music Group'}</span></div><audio src={audioUrl} controls autoPlay onEnded={playNext} /></section>}

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Personal collection</p><h2>Your playlists</h2></div><p>Create and rename playlists from your dashboard.</p></div>
        {!user ? <p className={styles.message}>Sign in to view and play your personal playlists. <Link href="/account">Subscriber login</Link></p> : playlists.length ? <div className={styles.playlistGrid}>{playlists.map(playlist => {
          const playlistSongs = (playlist.songIds || []).map(id => songById.get(id)).filter(Boolean) as Song[];
          return <article className={styles.playlistCard} key={playlist.id}><p className={styles.kicker}>Playlist</p><h3>{playlist.name || 'Untitled playlist'}</h3><p className={styles.playlistMeta}>{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</p><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!playlistSongs.length || Boolean(busy)} onClick={() => playPlaylist(playlist)}>Play playlist</button></div>{playlistSongs.length ? <div className={styles.playlistSongs}>{playlistSongs.map(song => <div className={styles.playlistSong} key={song.id}>{(song.coverImageUrl || song.imageUrl) ? <img src={song.coverImageUrl || song.imageUrl} alt="" /> : <span /> }<span><strong>{song.title || 'Untitled track'}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></span><button className={styles.remove} onClick={() => removeFromPlaylist(playlist.id, song.id)}>Remove</button></div>)}</div> : <p className={styles.empty}>Add songs from the catalogue below.</p>}</article>;
        })}</div> : <p className={styles.message}>You have no playlists yet. Create one in your <Link href="/account">member dashboard</Link>.</p>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Full catalogue</p><h2>Published releases</h2></div><p>{songs.length} tracks available</p></div>
        <div className={styles.catalogue}>{songs.map(song => <article className={styles.songCard} key={song.id}>{(song.coverImageUrl || song.imageUrl) && <img src={song.coverImageUrl || song.imageUrl} alt={`${song.title || 'Song'} cover`} />}<div className={styles.songBody}><h3>{song.title || 'Untitled track'}</h3><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.genre ? ` · ${song.genre}` : ''}</p><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={Boolean(busy)} onClick={() => playSong(song)}>{busy === `play-${song.id}` ? 'Loading…' : 'Play full track'}</button><button className={styles.button} disabled={Boolean(busy)} onClick={() => download(song)}>{busy === `download-${song.id}` ? 'Preparing…' : 'Download'}</button>{user && playlists.length > 0 && <><select className={styles.select} aria-label={`Choose playlist for ${song.title || 'song'}`} value={selectedPlaylists[song.id] || ''} onChange={event => setSelectedPlaylists(current => ({ ...current, [song.id]: event.target.value }))}><option value="">Choose playlist</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select><button className={styles.button} onClick={() => addToPlaylist(song)}>Add to playlist</button></>}</div></div></article>)}</div>
      </section>
    </main>
  );
}