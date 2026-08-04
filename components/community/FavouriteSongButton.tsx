'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Heart } from 'lucide-react';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { trackAnalytics } from '@/lib/track-analytics';
import styles from './FavouriteSongButton.module.css';

type Props = { songId: string; title: string; artistName?: string; artistId?: string; artwork?: string; slug?: string };

export function FavouriteSongButton({ songId, title, artistName = '', artistId = '', artwork = '', slug = '' }: Props) {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => {
    if (!user || !songId) { setSaved(false); return; }
    return onSnapshot(doc(firestore, 'members', user.uid, 'favoriteSongs', songId), snapshot => setSaved(snapshot.exists()));
  }, [songId, user]);

  async function toggle() {
    if (!user) { window.location.href = '/account?mode=signup'; return; }
    setBusy(true);
    try {
      const reference = doc(firestore, 'members', user.uid, 'favoriteSongs', songId);
      if (saved) {
        await deleteDoc(reference);
        trackAnalytics({ eventType: 'song_unlike', entityType: 'song', entityId: songId, title, artistId, artistName });
      } else {
        await setDoc(reference, { songId, title, artistName, artistId, artwork, slug, savedAt: serverTimestamp() });
        trackAnalytics({ eventType: 'song_like', entityType: 'song', entityId: songId, title, artistId, artistName });
      }
    } finally { setBusy(false); }
  }

  return <button className={`${styles.button} ${saved ? styles.saved : ''}`} type="button" disabled={busy} onClick={toggle} aria-label={saved ? `Remove ${title} from favourites` : `Save ${title} to favourites`} title={saved ? 'Saved to favourites' : 'Save to favourites'}><Heart size={15} fill={saved ? 'currentColor' : 'none'}/></button>;
}
