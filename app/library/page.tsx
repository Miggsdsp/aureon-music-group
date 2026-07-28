'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Clock3, GripVertical, ListPlus, Play, Search, Trash2 } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import styles from './library.module.css';

type Song = PlayerSong & {
  albumTitle?: string;
  artistImageUrl?: string;
  publishedAt?: unknown;
  releaseDate?: unknown;
};
type Playlist = { id: string; name?: string; songIds?: string[] };
type Member = { subscriptionStatus?: string; plan?: string };

const durationLabel = (seconds?: number) => seconds && Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
const yearLabel = (song: Song) => {
  if (song.releaseYear) return String(song.releaseYear);
  const source: any = song.releaseDate || song.publishedAt;
  const date = source?.toDate?.() || (source ? new Date(source) : null);
  return date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : '—';
};

export default function LibraryPage() {
  const { currentSong, playSong, playQueue, enqueue, enqueueMany } = useMusicPlayer();
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Record<string, string>>({});
  const [searchText, setSearchText] = useState('');
  const [artistFilter, setArtistFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState('');
  const [editingName, setEditingName] = useState('');
  const [dragState, setDragState] = useState<{ playlistId: string; index: number } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, current => {
    setUser(current);
    if (!current) { setMember(null); setAccessChecked(true); }
  }), []);

  useEffect(() => {
    if (!user) { setMember(null); setAccessChecked(true); return; }
    setAccessChecked(false);
    return onSnapshot(doc(firestore, 'members', user.uid), snapshot => {
      setMember(snapshot.exists() ? snapshot.data() as Member : null);
      setAccessChecked(true);
    }, () => { setMember(null); setAccessChecked(true); });
  }, [user]);

  const membershipStatus = String(member?.subscriptionStatus || 'inactive').toLowerCase();
  const hasAccess = membershipStatus === 'active' || membershipStatus === 'trialing';

  useEffect(() => {
    if (!user || !accessChecked || !hasAccess) { setSongs([]); setSongsLoading(false); return; }
    setSongsLoading(true);
    const publishedSongs = query(collection(firestore, 'songs'), where('status', '==', 'published'));
    return onSnapshot(publishedSongs, snapshot => {
      setSongs(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Song)));
      setSongsLoading(false);
    }, error => {
      console.error('Member catalogue listener failed', error);
      setSongs([]);
      setSongsLoading(false);
      setMessage('The published music catalogue could not be loaded. Please refresh the page.');
    });
  }, [user, accessChecked, hasAccess]);

  useEffect(() => {
    if (!user || !accessChecked || !hasAccess) { setPlaylists([]); return; }
    return onSnapshot(collection(firestore, 'members', user.uid, 'playlists'), snapshot => {
      setPlaylists(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Playlist)));
    }, error => {
      console.error('Playlist listener failed', error);
      setPlaylists([]);
      setMessage('Your playlists could not be loaded. Please refresh the page.');
    });
  }, [user, accessChecked, hasAccess]);

  const songById = useMemo(() => new Map(songs.map(song => [song.id, song])), [songs]);
  const artists = useMemo(() => Array.from(new Set(songs.map(song => song.artistName || song.artist).filter(Boolean) as string[])).sort(), [songs]);
  const genres = useMemo(() => Array.from(new Set(songs.map(song => song.genre).filter(Boolean) as string[])).sort(), [songs]);
  const filteredSongs = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return songs.filter(song => {
      const artist = song.artistName || song.artist || '';
      const matchesText = !needle || [song.title, artist, song.genre].some(value => String(value || '').toLowerCase().includes(needle));
      return matchesText && (artistFilter === 'all' || artist === artistFilter) && (genreFilter === 'all' || song.genre === genreFilter);
    });
  }, [artistFilter, genreFilter, searchText, songs]);

  async function memberRequest(path: string, method = 'GET') {
    if (!user) { window.location.href = '/account'; return null; }
    if (!hasAccess) throw new Error('Your paid membership is not active.');
    const token = await user.getIdToken();
    const response = await fetch(path, { method, headers: { authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function download(song: Song) {
    setBusy(`download-${song.id}`);
    try {
      const data = await memberRequest(`/api/member/download/${song.id}`, 'POST');
      if (data?.url) window.location.href = data.url;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to download this song.'); }
    finally { setBusy(''); }
  }

  async function createPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !newPlaylistName.trim()) return;
    try {
      await addDoc(collection(firestore, 'members', user.uid, 'playlists'), { name: newPlaylistName.trim(), songIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setNewPlaylistName('');
      setMessage('Playlist created.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to create playlist.'); }
  }

  async function renamePlaylist(playlistId: string) {
    if (!user || !editingName.trim()) return;
    await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), { name: editingName.trim(), updatedAt: serverTimestamp() });
    setEditingPlaylist(''); setEditingName(''); setMessage('Playlist renamed.');
  }

  async function deletePlaylist(playlistId: string) {
    if (!user || !window.confirm('Delete this playlist?')) return;
    await deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId));
    setMessage('Playlist deleted.');
  }

  async function saveSongIds(playlistId: string, songIds: string[]) {
    if (!user) return;
    await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), { songIds, updatedAt: serverTimestamp() });
  }

  async function addToPlaylist(song: Song) {
    const playlistId = selectedPlaylists[song.id];
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return setMessage('Choose a playlist first.');
    const songIds = playlist.songIds || [];
    if (songIds.includes(song.id)) return setMessage('That song is already in this playlist.');
    await saveSongIds(playlist.id, [...songIds, song.id]);
    setMessage(`${song.title || 'Song'} added to ${playlist.name || 'playlist'}.`);
  }

  async function removeFromPlaylist(playlist: Playlist, songId: string) {
    await saveSongIds(playlist.id, (playlist.songIds || []).filter(id => id !== songId));
  }

  async function dropSong(playlist: Playlist, targetIndex: number) {
    if (!dragState || dragState.playlistId !== playlist.id) return;
    const ids = [...(playlist.songIds || [])];
    const [moved] = ids.splice(dragState.index, 1);
    ids.splice(targetIndex, 0, moved);
    setDragState(null);
    await saveSongIds(playlist.id, ids);
  }

  return <main className={styles.shell}>
    <div className={styles.topbar}><Link href="/account">← Member dashboard</Link><Link href="/">Return to website</Link></div>
    <section className={styles.hero}><p className={styles.kicker}>Member Library</p><h1>Your music. Your way.</h1><p>Search every published Aureon release, build playlists and keep listening while you move around the website.</p></section>
    {message && <p className={styles.message}>{message}</p>}
    {user && accessChecked && !hasAccess && <p className={styles.message}>Your paid membership is not active. <Link href="/account">Open your dashboard to renew or choose a plan.</Link></p>}

    {hasAccess && <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Personal collection</p><h2>Your playlists</h2></div><form className={styles.quickCreate} onSubmit={createPlaylist}><input value={newPlaylistName} onChange={event => setNewPlaylistName(event.target.value)} placeholder="New playlist name" /><button className={`${styles.button} ${styles.buttonPrimary}`}>Create</button></form></div>
        {playlists.length ? <div className={styles.playlistGrid}>{playlists.map(playlist => {
          const playlistSongs = (playlist.songIds || []).map(id => songById.get(id)).filter(Boolean) as Song[];
          return <article className={styles.playlistCard} key={playlist.id}>
            <div className={styles.playlistTitleRow}><div><p className={styles.kicker}>Playlist</p>{editingPlaylist === playlist.id ? <div className={styles.renameRow}><input value={editingName} onChange={event => setEditingName(event.target.value)} autoFocus /><button onClick={() => renamePlaylist(playlist.id)}>Save</button></div> : <h3>{playlist.name || 'Untitled playlist'}</h3>}<p className={styles.playlistMeta}>{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</p></div><div className={styles.iconActions}><button title="Rename" onClick={() => { setEditingPlaylist(playlist.id); setEditingName(playlist.name || ''); }}>Rename</button><button title="Delete" onClick={() => deletePlaylist(playlist.id)}><Trash2 size={18} /></button></div></div>
            <div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!playlistSongs.length} onClick={() => playQueue(playlistSongs)}>Play playlist</button><button className={styles.button} disabled={!playlistSongs.length} onClick={() => enqueueMany(playlistSongs)}>Queue playlist</button></div>
            {playlistSongs.length ? <div className={styles.playlistSongs}>{playlistSongs.map((song, index) => <div className={`${styles.playlistSong} ${currentSong?.id === song.id ? styles.currentSong : ''}`} key={song.id} draggable onDragStart={() => setDragState({ playlistId: playlist.id, index })} onDragOver={event => event.preventDefault()} onDrop={() => dropSong(playlist, index)}><GripVertical size={17} /><button className={styles.songInfo} onClick={() => playSong(song, playlistSongs, index)}><strong>{song.title || 'Untitled track'}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></button><button className={styles.remove} onClick={() => removeFromPlaylist(playlist, song.id)}>Remove</button></div>)}</div> : <p className={styles.empty}>Add songs from the catalogue below.</p>}
          </article>;
        })}</div> : <p className={styles.message}>You have no playlists yet. Create your first playlist above.</p>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Full catalogue</p><h2>Published releases</h2></div><p>{filteredSongs.length} of {songs.length} tracks</p></div>
        <div className={styles.libraryTools}><label className={styles.searchBox}><Search size={18} /><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search song, artist or genre" /></label><select value={artistFilter} onChange={event => setArtistFilter(event.target.value)}><option value="all">All artists</option>{artists.map(artist => <option key={artist} value={artist}>{artist}</option>)}</select><select value={genreFilter} onChange={event => setGenreFilter(event.target.value)}><option value="all">All genres</option>{genres.map(genre => <option key={genre} value={genre}>{genre}</option>)}</select></div>
        {songsLoading ? <div className={styles.catalogue}>{[1,2,3].map(item => <div className={styles.skeletonCard} key={item}><div /><span /><span /></div>)}</div> : filteredSongs.length ? <div className={styles.catalogue}>{filteredSongs.map(song => <article className={styles.songCard} key={song.id}>
          <div className={styles.artworkWrap}>{(song.coverImageUrl || song.imageUrl) ? <img src={song.coverImageUrl || song.imageUrl} alt={`${song.title || 'Song'} cover`} /> : <div className={styles.artworkFallback}>AUREON</div>}{song.artistImageUrl && <img className={styles.artistAvatar} src={song.artistImageUrl} alt={`${song.artistName || song.artist || 'Artist'} portrait`} />}</div>
          <div className={styles.songBody}><h3>{song.title || 'Untitled track'}</h3><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.genre ? ` · ${song.genre}` : ''}</p><div className={styles.metadata}><span><Clock3 size={14} /> {durationLabel(song.duration)}</span><span>{yearLabel(song)}</span>{song.albumTitle && <span>{song.albumTitle}</span>}</div><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => playSong(song, filteredSongs, filteredSongs.findIndex(item => item.id === song.id))}><Play size={15} /> Play</button><button className={styles.button} onClick={() => enqueue(song)}><ListPlus size={15} /> Queue</button><button className={styles.button} disabled={busy === `download-${song.id}`} onClick={() => download(song)}>{busy === `download-${song.id}` ? 'Preparing…' : 'Download'}</button></div>{playlists.length > 0 && <div className={styles.addRow}><select value={selectedPlaylists[song.id] || ''} onChange={event => setSelectedPlaylists(current => ({ ...current, [song.id]: event.target.value }))}><option value="">Choose playlist</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select><button onClick={() => addToPlaylist(song)}>Add</button></div>}</div>
        </article>)}</div> : <div className={styles.emptyState}><h3>No matching releases</h3><p>Try removing a filter or searching for another title, artist or genre.</p><button className={styles.button} onClick={() => { setSearchText(''); setArtistFilter('all'); setGenreFilter('all'); }}>Clear filters</button></div>}
      </section>
    </>}
  </main>;
}
