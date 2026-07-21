'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { arrayUnion, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';

type Song = { id: string; title?: string; artistName?: string; artist?: string; genre?: string; coverImageUrl?: string; imageUrl?: string; status?: string };
type Playlist = { id: string; name?: string; songIds?: string[] };

export default function LibraryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Record<string,string>>({});
  const [playing, setPlaying] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => onSnapshot(collection(firestore, 'songs'), snapshot => setSongs(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Song)).filter(song => song.status === 'published'))), []);
  useEffect(() => {
    if (!user) { setPlaylists([]); return; }
    return onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snapshot => setPlaylists(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Playlist))));
  }, [user]);

  async function memberRequest(path: string, method = 'GET') {
    if (!user) { window.location.href = '/account'; return null; }
    const token = await user.getIdToken();
    const response = await fetch(path, { method, headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function play(song: Song) {
    setMessage('');
    try { const data = await memberRequest(`/api/member/stream/${song.id}`); if (!data) return; setPlaying(song.id); setAudioUrl(data.url); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to play this song.'); }
  }

  async function download(song: Song) {
    setMessage('');
    try { const data = await memberRequest(`/api/member/download/${song.id}`, 'POST'); if (data) window.location.href = data.url; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to download this song.'); }
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

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero"><p className="section-kicker">Member Library</p><h1>The Aureon catalogue</h1><p>Stream full tracks, use your monthly downloads and build personal playlists from every published Aureon song.</p><div className="member-actions"><Link className="primary-button" href="/account">← Member dashboard</Link>{!user && <Link className="primary-button" href="/account">Subscriber login</Link>}</div></section>
      {message && <p className="form-message">{message}</p>}
      {audioUrl && <section className="member-player"><p>Now playing: {songs.find(song => song.id === playing)?.title}</p><audio src={audioUrl} controls autoPlay /></section>}
      {user && playlists.length === 0 && <p className="form-message">Create a playlist in your <Link href="/account">member dashboard</Link>, then return here to add songs.</p>}
      <section className="member-song-list">
        {songs.map(song => (
          <article key={song.id}>
            {(song.coverImageUrl || song.imageUrl) && <img src={song.coverImageUrl || song.imageUrl} alt={`${song.title || 'Song'} cover`} />}
            <div><h2>{song.title || 'Untitled track'}</h2><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.genre ? ` · ${song.genre}` : ''}</p></div>
            <div className="member-actions"><button onClick={() => play(song)}>Play full track</button><button onClick={() => download(song)}>Member download</button>{user && playlists.length > 0 && <><select aria-label={`Choose playlist for ${song.title || 'song'}`} value={selectedPlaylists[song.id] || ''} onChange={event => setSelectedPlaylists(current => ({ ...current, [song.id]: event.target.value }))}><option value="">Choose playlist</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select><button onClick={() => addToPlaylist(song)}>Add to playlist</button></>}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
