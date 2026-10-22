'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowLeft, Clock3, ListMusic, ListPlus, Play, Plus, Search, Shuffle, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import { getArtwork } from '@/lib/get-artwork';
import { formatPlaylistDuration, shufflePlaylist } from '@/lib/playlist-utils';
import styles from './playlist-detail.module.css';

type Song = PlayerSong & { albumTitle?: string; trackNumber?: number };
type Playlist = { id: string; name?: string; songIds?: string[]; imageUrl?: string };
type Member = { subscriptionStatus?: string };
type CatalogueSong = Record<string, any>;

function normalizeSong(id: string, data: CatalogueSong): Song {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  const artistName = data.artistName || details.artistName || data.artist || details.artist;
  const artwork = getArtwork(data);
  return {
    id,
    title: data.title || details.title || data.name || details.name || 'Untitled track',
    artistName,
    artist: data.artist || details.artist || artistName,
    albumTitle: data.albumTitle || details.albumTitle || data.album || details.album || '',
    duration: Number(data.duration || details.duration || data.durationSeconds || details.durationSeconds || 0) || undefined,
    trackNumber: Number(data.trackNumber || details.trackNumber || 0) || undefined,
    coverImageUrl: artwork,
    imageUrl: artwork,
  };
}

const durationLabel = (seconds?: number) => seconds && Number.isFinite(seconds)
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  : '—';

export default function PlaylistDetailPage() {
  const params = useParams<{ playlistId: string }>();
  const playlistId = decodeURIComponent(String(params.playlistId || ''));
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoplayRequested = searchParams.get('autoplay') === '1';
  const autoplayAttempted = useRef(false);
  const { currentSong, playQueue, playSong, enqueue, openQueue } = useMusicPlayer();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [memberReady, setMemberReady] = useState(false);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [catalogue, setCatalogue] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [addingOpen, setAddingOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(firebaseAuth, value => {
    setUser(value);
    setAuthReady(true);
  }), []);

  useEffect(() => {
    if (!user) { setMember(null); setMemberReady(authReady); return; }
    setMemberReady(false);
    return onSnapshot(doc(firestore, 'members', user.uid), snapshot => {
      setMember(snapshot.exists() ? snapshot.data() as Member : null);
      setMemberReady(true);
    }, () => { setMember(null); setMemberReady(true); });
  }, [authReady, user]);

  const hasAccess = ['active', 'trialing'].includes(String(member?.subscriptionStatus || '').toLowerCase());

  useEffect(() => {
    if (!user || !memberReady || !hasAccess || !playlistId) {
      setPlaylist(null); setCatalogue([]); return;
    }
    const playlistRef = doc(firestore, 'members', user.uid, 'playlists', playlistId);
    const stopPlaylist = onSnapshot(playlistRef, snapshot => {
      setPlaylist(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Playlist : null);
    }, () => setMessage('This playlist could not be loaded. Please refresh the page.'));
    const publishedSongs = query(collection(firestore, 'songs'), where('status', '==', 'published'));
    const stopSongs = onSnapshot(publishedSongs, snapshot => {
      setCatalogue(snapshot.docs.map(item => normalizeSong(item.id, item.data())));
    }, () => setMessage('The published music catalogue could not be loaded.'));
    return () => { stopPlaylist(); stopSongs(); };
  }, [hasAccess, memberReady, playlistId, user]);

  const catalogueById = useMemo(() => new Map(catalogue.map(song => [song.id, song])), [catalogue]);
  const playlistSongs = useMemo(() => (playlist?.songIds || []).map(id => catalogueById.get(id)).filter(Boolean) as Song[], [catalogueById, playlist?.songIds]);
  const songs = playlistSongs;
  // A dashboard playlist tap opens this page and starts the selected queue.
  // Safari may require a second tap for sound after navigation; Play All remains available.
  useEffect(() => {
    if (!autoplayRequested || autoplayAttempted.current || !hasAccess || !playlist || !playlistSongs.length) return;
    autoplayAttempted.current = true;
    void playQueue(playlistSongs);
  }, [autoplayRequested, hasAccess, playlist, playlistSongs, playQueue]);
  const availableSongs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalogue.filter(song => !(playlist?.songIds || []).includes(song.id)
      && (!needle || [song.title, song.artistName, song.albumTitle].some(value => String(value || '').toLowerCase().includes(needle))));
  }, [catalogue, playlist?.songIds, search]);
  const cover = playlist?.imageUrl || playlistSongs[0]?.coverImageUrl || '/images/branding/Aureon_Header_Logo.png';
  const isCurrent = (song: Song) => currentSong?.id === song.id;

  const persistSongIds = useCallback(async (songIds: string[]) => {
    if (!user || !playlist) return;
    await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id), { songIds, updatedAt: serverTimestamp() });
  }, [playlist, user]);

  async function addSong(song: Song) {
    if (!user || !playlist) return;
    setBusy(true); setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/member/playlists/${encodeURIComponent(playlist.id)}/songs`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ songId: song.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add this song.');
      setMessage(result.added ? `${song.title} added to playlist.` : 'This song is already in the playlist.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add this song.'); }
    finally { setBusy(false); }
  }

  async function removeSong(song: Song) {
    try { await persistSongIds((playlist?.songIds || []).filter(id => id !== song.id)); }
    catch { setMessage('Unable to remove this song. Please try again.'); }
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!user || !playlist || !name) return;
    setBusy(true);
    try {
      await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id), { name, updatedAt: serverTimestamp() });
      setRenaming(false); setMessage('Playlist renamed.');
    } catch { setMessage('Unable to rename this playlist.'); }
    finally { setBusy(false); }
  }

  async function uploadArtwork(file?: File) {
    if (!user || !playlist || !file) return;
    setBusy(true); setMessage('');
    try {
      const token = await user.getIdToken();
      const form = new FormData(); form.set('playlistId', playlist.id); form.set('image', file);
      const response = await fetch('/api/member/playlist-image', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update playlist artwork.');
      setMessage('Playlist artwork updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update playlist artwork.'); }
    finally { setBusy(false); }
  }

  async function deleteCurrentPlaylist() {
    if (!user || !playlist || !window.confirm(`Delete “${playlist.name || 'Untitled playlist'}”? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(firestore, 'members', user.uid, 'playlists', playlist.id));
      router.push('/library');
    } catch { setMessage('Unable to delete this playlist.'); }
  }

  if (!authReady || (user && !memberReady)) return <main className={styles.shell}><p className={styles.status}>Loading your playlist…</p></main>;
  if (!user) return <main className={styles.shell}><div className={styles.accessCard}><p className={styles.eyebrow}>Your Aureon library</p><h1>Sign in to open this playlist.</h1><p>Your playlists are private to your member account.</p><Link className={styles.goldButton} href={`/account?next=${encodeURIComponent(`/library/playlists/${playlistId}`)}`}>Sign in to continue</Link></div></main>;
  if (!hasAccess) return <main className={styles.shell}><div className={styles.accessCard}><p className={styles.eyebrow}>Member playlist</p><h1>An active membership is required.</h1><p>Choose a Listener or Creator membership to manage personal playlists.</p><Link className={styles.goldButton} href="/membership">Explore membership</Link></div></main>;
  if (memberReady && !playlist) return <main className={styles.shell}><div className={styles.accessCard}><p className={styles.eyebrow}>Playlist unavailable</p><h1>We couldn’t find this playlist.</h1><Link className={styles.goldButton} href="/library">Back to your library</Link></div></main>;

  return <main className={styles.shell}>
    <header className={styles.topbar}><Link href="/library"><ArrowLeft size={17}/> Your library</Link><button type="button" onClick={openQueue}><ListMusic size={17}/> Up Next</button></header>
    <section className={styles.hero}>
      <div className={styles.artFrame}><img src={cover} alt={`${playlist?.name || 'Playlist'} artwork`}/><span className={styles.artGlow}/></div>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>Aureon · Personal playlist</p>
        {renaming ? <div className={styles.rename}><input aria-label="Playlist name" value={nameDraft} onChange={event => setNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void saveName(); if (event.key === 'Escape') setRenaming(false); }}/><button disabled={busy} onClick={() => void saveName()}>Save</button><button aria-label="Cancel rename" onClick={() => setRenaming(false)}><X size={18}/></button></div> : <h1>{playlist?.name || 'Untitled playlist'}</h1>}
        <p className={styles.description}>Your collection, gathered in one place.</p>
        <p className={styles.meta}><strong>{playlistSongs.length} {playlistSongs.length === 1 ? 'track' : 'tracks'}</strong><span>·</span>{formatPlaylistDuration(playlistSongs)}</p>
        <div className={styles.primaryActions}><button className={styles.goldButton} disabled={!playlistSongs.length} onClick={() => void playQueue(playlistSongs)}><Play size={18} fill="currentColor"/> Play All</button><button className={styles.outlineButton} disabled={!playlistSongs.length} onClick={() => void playQueue(shufflePlaylist(playlistSongs))}><Shuffle size={18}/> Shuffle</button></div>
        <div className={styles.manageActions}><button onClick={() => { setNameDraft(playlist?.name || ''); setRenaming(true); }}>Rename</button><label><Upload size={15}/> Change artwork<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void uploadArtwork(event.target.files?.[0]); event.currentTarget.value = ''; }}/></label><button className={styles.danger} onClick={() => void deleteCurrentPlaylist()}><Trash2 size={15}/> Delete playlist</button></div>
      </div>
    </section>
    {message && <p className={styles.notice} role="status">{message}</p>}
    <section className={styles.tracksSection}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>The collection</p><h2>Tracks</h2></div><button className={styles.addButton} onClick={() => setAddingOpen(value => !value)}><Plus size={17}/>{addingOpen ? 'Done adding' : 'Add tracks'}</button></div>
      {addingOpen && <div className={styles.addPanel}><label className={styles.search}><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the published catalogue"/></label>{availableSongs.length ? <div className={styles.addResults}>{availableSongs.slice(0, 12).map(song => <div className={styles.addResult} key={song.id}><img src={song.coverImageUrl || '/images/branding/Aureon_Header_Logo.png'} alt=""/><span><strong>{song.title}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></span><button disabled={busy} onClick={() => void addSong(song)} aria-label={`Add ${song.title} to playlist`}><Plus size={18}/></button></div>)}</div> : <p className={styles.muted}>No more matching published tracks.</p>}</div>}
      <div className={styles.trackList}>
        <div className={styles.trackHeader}><span>#</span><span>Title</span><span>Album</span><span><Clock3 size={15}/></span><span/></div>
        {songs.length ? songs.map((song, index) => <article className={`${styles.track} ${isCurrent(song) ? styles.currentTrack : ''}`} key={song.id}>
          <button className={styles.trackNumber} aria-label={`Play ${song.title}`} onClick={() => void playSong(song, songs, index)}>{isCurrent(song) ? <span className={styles.equalizer}>♫</span> : <><span className={styles.number}>{index + 1}</span><Play className={styles.hoverPlay} size={17} fill="currentColor"/></>}</button>
          <button className={styles.trackTitle} onClick={() => void playSong(song, songs, index)}><img src={song.coverImageUrl || '/images/branding/Aureon_Header_Logo.png'} alt=""/><span><strong>{song.title}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></span></button>
          <span className={styles.album}>{song.albumTitle || '—'}</span><span className={styles.duration}>{durationLabel(song.duration)}</span>
          <div className={styles.trackActions}><button aria-label={`Add ${song.title} to Up Next`} title="Add to Up Next" onClick={() => enqueue(song)}><ListPlus size={18}/></button><button aria-label={`Remove ${song.title} from playlist`} title="Remove from playlist" onClick={() => void removeSong(song)}><X size={17}/></button></div>
        </article>) : <div className={styles.empty}><p>This playlist is ready for a soundtrack.</p><button onClick={() => setAddingOpen(true)}>Add your first tracks</button></div>}
      </div>
    </section>
    <footer className={styles.footer}><span>PLAYING ACROSS AUREON</span><button onClick={openQueue}><ListMusic size={17}/> Open Up Next queue</button></footer>
  </main>;
}
