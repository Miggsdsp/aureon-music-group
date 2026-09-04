'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ChevronDown, Clock3, GripVertical, ImagePlus, ListPlus, Play, Search, Trash2, X } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { type PlayerSong, useMusicPlayer } from '@/components/music/MusicPlayerProvider';
import { getArtwork } from '@/lib/get-artwork';
import styles from './library.module.css';

type Song = PlayerSong & {
  albumTitle?: string;
  artistImageUrl?: string;
  publishedAt?: unknown;
  releaseDate?: unknown;
  trackNumber?: number;
  details?: Record<string, any>;
};
type Playlist = { id: string; name?: string; songIds?: string[]; imageUrl?: string };
type Member = { subscriptionStatus?: string; plan?: string };

type AlbumGroup = { title: string; artwork: string; songs: Song[] };
type ArtistGroup = { name: string; albums: AlbumGroup[] };

const durationLabel = (seconds?: number) => seconds && Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
const yearLabel = (song: Song) => {
  if (song.releaseYear) return String(song.releaseYear);
  const source: any = song.releaseDate || song.details?.releaseDate || song.publishedAt || song.details?.publishedAt;
  const date = source?.toDate?.() || (source ? new Date(source) : null);
  return date && !Number.isNaN(date.getTime()) ? String(date.getFullYear()) : '—';
};

function normalizeSong(id: string, data: Record<string, any>): Song {
  const details = data.details && typeof data.details === 'object' ? data.details : {};
  return {
    id,
    ...data,
    details,
    title: data.title || details.title || data.name || details.name,
    artistName: data.artistName || details.artistName || data.artist || details.artist,
    artist: data.artist || details.artist,
    genre: data.genre || details.genre,
    albumTitle: data.albumTitle || details.albumTitle,
    artistImageUrl: data.artistImageUrl || details.artistImageUrl || data.profileImageUrl || details.profileImageUrl,
    duration: Number(data.duration || details.duration || data.durationSeconds || details.durationSeconds || 0) || undefined,
    releaseYear: data.releaseYear || details.releaseYear || data.year || details.year,
    releaseDate: data.releaseDate || details.releaseDate,
    trackNumber: Number(data.trackNumber || details.trackNumber || 0) || undefined,
    coverImageUrl: getArtwork(data),
    imageUrl: getArtwork(data),
  };
}

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
  const [openPlaylistId, setOpenPlaylistId] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState('');
  const [editingName, setEditingName] = useState('');
  const [dragState, setDragState] = useState<{ playlistId: string; index: number } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [downloadLimitOpen, setDownloadLimitOpen] = useState(false);

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

  useEffect(() => {
    if (!downloadLimitOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDownloadLimitOpen(false); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKeyDown); };
  }, [downloadLimitOpen]);

  const membershipStatus = String(member?.subscriptionStatus || 'inactive').toLowerCase();
  const hasAccess = membershipStatus === 'active' || membershipStatus === 'trialing';
  const isCreator = String(member?.plan || '').toLowerCase() === 'creator';

  useEffect(() => {
    if (!user || !accessChecked || !hasAccess) { setSongs([]); setSongsLoading(false); return; }
    setSongsLoading(true);
    const publishedSongs = query(collection(firestore, 'songs'), where('status', '==', 'published'));
    return onSnapshot(publishedSongs, snapshot => {
      setSongs(snapshot.docs.map(item => normalizeSong(item.id, item.data())));
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
      const matchesText = !needle || [song.title, artist, song.genre, song.albumTitle].some(value => String(value || '').toLowerCase().includes(needle));
      return matchesText && (artistFilter === 'all' || artist === artistFilter) && (genreFilter === 'all' || song.genre === genreFilter);
    }).sort((a, b) => String(a.artistName || a.artist || '').localeCompare(String(b.artistName || b.artist || '')) || String(a.albumTitle || '').localeCompare(String(b.albumTitle || '')) || Number(a.trackNumber || 999) - Number(b.trackNumber || 999));
  }, [artistFilter, genreFilter, searchText, songs]);

  const artistGroups = useMemo<ArtistGroup[]>(() => {
    const map = new Map<string, Map<string, Song[]>>();
    filteredSongs.forEach(song => {
      const artist = String(song.artistName || song.artist || 'Aureon Music Group');
      const album = String(song.albumTitle || 'Singles & other releases');
      if (!map.has(artist)) map.set(artist, new Map());
      const albums = map.get(artist)!;
      if (!albums.has(album)) albums.set(album, []);
      albums.get(album)!.push(song);
    });
    return Array.from(map.entries()).map(([name, albums]) => ({
      name,
      albums: Array.from(albums.entries()).map(([title, albumSongs]) => ({
        title,
        artwork: albumSongs[0]?.coverImageUrl || albumSongs[0]?.imageUrl || '/images/branding/Aureon_Header_Logo.png',
        songs: [...albumSongs].sort((a, b) => Number(a.trackNumber || 999) - Number(b.trackNumber || 999) || String(a.title || '').localeCompare(String(b.title || ''))),
      })),
    }));
  }, [filteredSongs]);

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
    if (!isCreator) throw new Error('Listener members can stream the full catalogue but cannot download subscription music.');
    setBusy(`download-${song.id}`);
    try {
      const data = await memberRequest(`/api/member/download/${song.id}`, 'POST');
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to download this song.';
      if (/five Creator downloads|five Creator selections|allowance resets/i.test(errorMessage)) { setMessage(''); setDownloadLimitOpen(true); }
      else setMessage(errorMessage);
    } finally { setBusy(''); }
  }

  async function createPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !newPlaylistName.trim()) return;
    try {
      const created = await addDoc(collection(firestore, 'members', user.uid, 'playlists'), { name: newPlaylistName.trim(), songIds: [], imageUrl: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setNewPlaylistName(''); setOpenPlaylistId(created.id); setMessage('Playlist created.');
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
    if (openPlaylistId === playlistId) setOpenPlaylistId('');
    setMessage('Playlist deleted.');
  }

  async function uploadPlaylistImage(playlistId: string, file?: File) {
    if (!user || !file) return;
    setBusy(`playlist-image-${playlistId}`); setMessage('');
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.set('playlistId', playlistId);
      form.set('image', file);
      const response = await fetch('/api/member/playlist-image', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to upload playlist image.');
      setMessage('Playlist image updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to upload playlist image.'); }
    finally { setBusy(''); }
  }

  async function saveSongIds(playlistId: string, songIds: string[]) {
    if (!user) return;
    await updateDoc(doc(firestore, 'members', user.uid, 'playlists', playlistId), { songIds, updatedAt: serverTimestamp() });
  }

  async function addToPlaylist(song: Song) {
    const playlistId = selectedPlaylists[song.id];
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) { setMessage('Choose a playlist first.'); return; }
    if ((playlist.songIds || []).includes(song.id)) { setMessage('That song is already in this playlist.'); return; }
    if (!user) { setMessage('Please sign in again.'); return; }

    setBusy(`playlist-add-${song.id}`);
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/member/playlists/${encodeURIComponent(playlist.id)}/songs`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ songId: song.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to add this song to your playlist.');
      if (!data.added) setMessage('That song is already in this playlist.');
      else setMessage(`${song.title || 'Song'} added to ${playlist.name || 'playlist'}.`);
      setSelectedPlaylists(current => ({ ...current, [song.id]: '' }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add this song to your playlist.');
    } finally {
      setBusy('');
    }
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

  function songActions(song: Song, queue: Song[]) {
    const index = queue.findIndex(item => item.id === song.id);
    return <><div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} onClick={() => playSong(song, queue, index)}><Play size={15}/> Play</button><button className={styles.button} onClick={() => enqueue(song)}><ListPlus size={15}/> Queue</button>{isCreator && <button className={styles.button} disabled={busy === `download-${song.id}`} onClick={() => download(song)}>{busy === `download-${song.id}` ? 'Preparing…' : 'Download'}</button>}</div>{playlists.length > 0 && <div className={styles.addRow}><select value={selectedPlaylists[song.id] || ''} onChange={event => setSelectedPlaylists(current => ({ ...current, [song.id]: event.target.value }))}><option value="">Choose playlist</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select><button disabled={busy === `playlist-add-${song.id}`} onClick={() => addToPlaylist(song)}>{busy === `playlist-add-${song.id}` ? 'Adding…' : 'Add'}</button></div>}</>;
  }

  return <main className={styles.shell}>
    <style jsx global>{`
      @media (max-width: 700px) {
        .aureon-library-album-song { display:grid !important; grid-template-columns:1fr !important; gap:12px !important; padding:14px 10px !important; }
        .aureon-library-song-info { display:grid !important; grid-template-columns:28px minmax(0,1fr) !important; gap:12px !important; width:100% !important; min-width:0 !important; }
        .aureon-library-song-info strong { white-space:normal !important; overflow:visible !important; text-overflow:clip !important; line-height:1.25 !important; }
        .aureon-library-song-actions { display:grid !important; grid-template-columns:44px 44px minmax(0,1fr) 58px !important; gap:8px !important; padding-left:40px !important; width:100% !important; box-sizing:border-box !important; align-items:center !important; }
        .aureon-library-song-actions select { width:100% !important; max-width:none !important; min-width:0 !important; height:44px !important; font-size:16px !important; }
        .aureon-library-song-actions button { width:44px !important; min-width:44px !important; height:44px !important; }
        .aureon-library-song-actions button.aureon-library-add { width:58px !important; min-width:58px !important; border-radius:12px !important; }
      }
      @media (max-width: 390px) {
        .aureon-library-song-actions { grid-template-columns:42px 42px minmax(0,1fr) 54px !important; padding-left:36px !important; gap:6px !important; }
        .aureon-library-song-actions button { width:42px !important; min-width:42px !important; height:42px !important; }
        .aureon-library-song-actions button.aureon-library-add { width:54px !important; min-width:54px !important; }
      }
    `}</style>
    <div className={styles.topbar}><Link href="/account">← Member dashboard</Link><Link href="/">Return to website</Link></div>
    <section className={styles.hero}><p className={styles.kicker}>Member Library</p><h1>Your music. Your way.</h1><p>Find music by artist, open an album to see its songs, or search directly for any track.</p></section>
    {message && <p className={styles.message}>{message}</p>}
    {user && accessChecked && !hasAccess && <p className={styles.message}>Your paid membership is not active. <Link href="/account">Open your dashboard to renew or choose a plan.</Link></p>}

    {hasAccess && <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Personal collection</p><h2>Your playlists</h2></div><form className={styles.quickCreate} onSubmit={createPlaylist}><input value={newPlaylistName} onChange={event => setNewPlaylistName(event.target.value)} placeholder="New playlist name"/><button className={`${styles.button} ${styles.buttonPrimary}`}>Create</button></form></div>
        {playlists.length ? <div className={styles.playlistGrid}>{playlists.map(playlist => {
          const playlistSongs = (playlist.songIds || []).map(id => songById.get(id)).filter(Boolean) as Song[];
          const cover = playlist.imageUrl || playlistSongs[0]?.coverImageUrl || playlistSongs[0]?.imageUrl || '/images/branding/Aureon_Header_Logo.png';
          const open = openPlaylistId === playlist.id;
          return <article className={`${styles.playlistCard} ${open ? styles.playlistCardOpen : ''}`} key={playlist.id}>
            <button className={styles.playlistSummary} type="button" onClick={() => setOpenPlaylistId(open ? '' : playlist.id)} aria-expanded={open}>
              <img src={cover} alt=""/><div><p className={styles.kicker}>Playlist</p><h3>{playlist.name || 'Untitled playlist'}</h3><p className={styles.playlistMeta}>{playlistSongs.length} {playlistSongs.length === 1 ? 'song' : 'songs'}</p></div><ChevronDown className={open ? styles.chevronOpen : ''}/>
            </button>
            {open && <div className={styles.playlistDetail}>
              <div className={styles.playlistEditBar}>{editingPlaylist === playlist.id ? <div className={styles.renameRow}><input value={editingName} onChange={event => setEditingName(event.target.value)} autoFocus/><button onClick={() => renamePlaylist(playlist.id)}>Save</button></div> : <button onClick={() => { setEditingPlaylist(playlist.id); setEditingName(playlist.name || ''); }}>Rename</button>}<label className={styles.imageUpload}><ImagePlus size={16}/>{busy === `playlist-image-${playlist.id}` ? 'Uploading…' : 'Change image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy === `playlist-image-${playlist.id}`} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadPlaylistImage(playlist.id, file); event.currentTarget.value = ''; }}/></label><button title="Delete" onClick={() => deletePlaylist(playlist.id)}><Trash2 size={18}/> Delete</button></div>
              <div className={styles.actions}><button className={`${styles.button} ${styles.buttonPrimary}`} disabled={!playlistSongs.length} onClick={() => playQueue(playlistSongs)}>Play playlist</button><button className={styles.button} disabled={!playlistSongs.length} onClick={() => enqueueMany(playlistSongs)}>Queue playlist</button></div>
              {playlistSongs.length ? <div className={styles.playlistSongs}>{playlistSongs.map((song, index) => <div className={`${styles.playlistSong} ${currentSong?.id === song.id ? styles.currentSong : ''}`} key={song.id} draggable onDragStart={() => setDragState({ playlistId: playlist.id, index })} onDragOver={event => event.preventDefault()} onDrop={() => dropSong(playlist, index)}><GripVertical size={17}/><button className={styles.songInfo} onClick={() => playSong(song, playlistSongs, index)}><strong>{song.title || 'Untitled track'}</strong><small>{song.artistName || song.artist || 'Aureon Music Group'}</small></button><button className={styles.remove} onClick={() => removeFromPlaylist(playlist, song.id)}>Remove</button></div>)}</div> : <p className={styles.empty}>Add songs from the catalogue below.</p>}
            </div>}
          </article>;
        })}</div> : <p className={styles.message}>You have no playlists yet. Create your first playlist above.</p>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>Full catalogue</p><h2>Browse music</h2></div><p>{filteredSongs.length} of {songs.length} tracks</p></div>
        <div className={styles.libraryTools}><label className={styles.searchBox}><Search size={20}/><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search song, album, artist or genre"/></label><select value={artistFilter} onChange={event => setArtistFilter(event.target.value)}><option value="all">All artists</option>{artists.map(artist => <option key={artist} value={artist}>{artist}</option>)}</select><select value={genreFilter} onChange={event => setGenreFilter(event.target.value)}><option value="all">All genres</option>{genres.map(genre => <option key={genre} value={genre}>{genre}</option>)}</select></div>
        {songsLoading ? <div className={styles.catalogue}>{[1,2,3].map(item => <div className={styles.skeletonCard} key={item}><div/><span/><span/></div>)}</div> : !filteredSongs.length ? <div className={styles.emptyState}><h3>No matching releases</h3><p>Try another song, album, artist or genre.</p><button className={styles.button} onClick={() => { setSearchText(''); setArtistFilter('all'); setGenreFilter('all'); }}>Clear filters</button></div> : searchText.trim() ? <div className={styles.catalogue}>{filteredSongs.map(song => <article className={styles.songCard} key={song.id}><div className={styles.artworkWrap}><img src={song.coverImageUrl || song.imageUrl || '/images/branding/Aureon_Header_Logo.png'} alt={`${song.title || 'Song'} cover`}/></div><div className={styles.songBody}><h3>{song.title || 'Untitled track'}</h3><p>{song.artistName || song.artist || 'Aureon Music Group'}{song.albumTitle ? ` · ${song.albumTitle}` : ''}</p><div className={styles.metadata}><span><Clock3 size={14}/> {durationLabel(song.duration)}</span><span>{yearLabel(song)}</span></div>{songActions(song, filteredSongs)}</div></article>)}</div> : <div className={styles.artistDirectory}>{artistGroups.map(artist => <section className={styles.artistGroup} key={artist.name}><div className={styles.artistHeading}><div><p className={styles.kicker}>Artist</p><h3>{artist.name}</h3></div><span>{artist.albums.length} {artist.albums.length === 1 ? 'album' : 'albums'}</span></div><div className={styles.albumGrid}>{artist.albums.map(album => <details className={styles.albumFolder} key={`${artist.name}-${album.title}`}><summary><img src={album.artwork} alt=""/><div><strong>{album.title}</strong><span>{album.songs.length} {album.songs.length === 1 ? 'track' : 'tracks'}</span></div><ChevronDown/></summary><div className={styles.albumSongs}>{album.songs.map((song, index) => <article className={`${styles.albumSong} aureon-library-album-song ${currentSong?.id === song.id ? styles.currentSong : ''}`} key={song.id}><button className={`${styles.albumSongInfo} aureon-library-song-info`} onClick={() => playSong(song, album.songs, index)}><span>{song.trackNumber || index + 1}</span><div><strong>{song.title || 'Untitled track'}</strong><small>{durationLabel(song.duration)}</small></div></button><div className={`${styles.albumSongActions} aureon-library-song-actions`}><button onClick={() => playSong(song, album.songs, index)} aria-label={`Play ${song.title || 'track'}`}><Play size={16}/></button><button onClick={() => enqueue(song)} aria-label={`Queue ${song.title || 'track'}`}><ListPlus size={16}/></button>{playlists.length > 0 && <select aria-label={`Add ${song.title || 'track'} to playlist`} value={selectedPlaylists[song.id] || ''} onChange={event => { const value = event.target.value; setSelectedPlaylists(current => ({ ...current, [song.id]: value })); }}><option value="">Playlist…</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name || 'Untitled playlist'}</option>)}</select>}{playlists.length > 0 && <button className="aureon-library-add" disabled={busy === `playlist-add-${song.id}`} onClick={() => addToPlaylist(song)}>{busy === `playlist-add-${song.id}` ? '…' : 'Add'}</button>}{isCreator && <button disabled={busy === `download-${song.id}`} onClick={() => download(song)}>↓</button>}</div></article>)}</div></details>)}</div></section>)}</div>}
      </section>
    </>}

    {downloadLimitOpen && <div className={styles.limitBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDownloadLimitOpen(false); }}><section className={styles.limitModal} role="dialog" aria-modal="true" aria-labelledby="creator-download-limit-title"><button className={styles.limitClose} type="button" aria-label="Close" onClick={() => setDownloadLimitOpen(false)}><X size={22}/></button><img className={styles.limitLogo} src="/images/branding/Aureon_Header_Logo.png" alt="Aureon Music Group"/><p className={styles.limitKicker}>Creator membership</p><h2 id="creator-download-limit-title">Your monthly download limit has been reached</h2><div className={styles.limitCount}>5 / 5</div><p>You have used all 5 Creator song selections available in your current billing period.</p><p>Your full Aureon catalogue streaming access remains active. Your Creator download allowance will reset automatically at your next billing cycle.</p><button className={`${styles.button} ${styles.buttonPrimary} ${styles.limitButton}`} type="button" onClick={() => setDownloadLimitOpen(false)}>Continue listening</button><Link className={styles.limitAccountLink} href="/account">View Creator membership</Link></section></div>}
  </main>;
}
