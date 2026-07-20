'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';

type Song = { id: string; title?: string; artistName?: string; artist?: string; genre?: string; coverImageUrl?: string; imageUrl?: string; status?: string };

export default function LibraryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playing, setPlaying] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => onSnapshot(collection(firestore, 'songs'), snapshot => {
    setSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song)).filter(song => song.status === 'published'));
  }), []);

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
    try {
      const data = await memberRequest(`/api/member/stream/${song.id}`);
      if (!data) return;
      setPlaying(song.id);
      setAudioUrl(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to play this song.');
    }
  }

  async function download(song: Song) {
    setMessage('');
    try {
      const data = await memberRequest(`/api/member/download/${song.id}`, 'POST');
      if (data) window.location.href = data.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download this song.');
    }
  }

  return (
    <main className="page-shell">
      <section className="page-hero compact-hero"><p className="section-kicker">Member Library</p><h1>The Aureon catalogue</h1><p>Stream full tracks with an active membership. Members receive up to five downloads per billing month.</p></section>
      {message && <p className="form-message">{message}</p>}
      {audioUrl && <section className="member-player"><p>Now playing: {songs.find(song => song.id === playing)?.title}</p><audio src={audioUrl} controls autoPlay /></section>}
      <section className="member-song-list">
        {songs.map(song => (
          <article key={song.id}>
            {(song.coverImageUrl || song.imageUrl) && <img src={song.coverImageUrl || song.imageUrl} alt="" />}
            <div><h2>{song.title || 'Untitled track'}</h2><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.genre ? ` · ${song.genre}` : ''}</p></div>
            <div className="member-actions"><button onClick={() => play(song)}>Play full track</button><button onClick={() => download(song)}>Member download</button></div>
          </article>
        ))}
      </section>
    </main>
  );
}
