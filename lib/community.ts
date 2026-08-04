import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export type CommunityAchievement = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  target: number;
};

export function communityHandle(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function publicName(value: unknown) {
  return String(value || 'Aureon Listener').trim().slice(0, 60) || 'Aureon Listener';
}

export function computeCommunityAchievements(input: {
  songsPlayed: number;
  listeningMinutes: number;
  playlists: number;
  followedArtists: number;
  favouriteSongs: number;
  referrals: number;
}) {
  const definitions: Array<Omit<CommunityAchievement, 'unlocked' | 'progress'>> = [
    { id: 'first-listen', title: 'First Note', description: 'Listen to your first Aureon song.', icon: '♪', target: 1 },
    { id: 'explorer', title: 'Catalogue Explorer', description: 'Play 25 different songs.', icon: '◇', target: 25 },
    { id: 'listener-10h', title: 'Golden Listener', description: 'Reach 10 hours of listening.', icon: '◉', target: 600 },
    { id: 'playlist-maker', title: 'Curator', description: 'Create three personal playlists.', icon: '≡', target: 3 },
    { id: 'artist-supporter', title: 'Artist Supporter', description: 'Follow five Aureon artists.', icon: '★', target: 5 },
    { id: 'collector', title: 'Collector', description: 'Save 20 favourite songs.', icon: '♥', target: 20 },
    { id: 'ambassador', title: 'Community Ambassador', description: 'Refer one verified Aureon member.', icon: '↗', target: 1 },
  ];
  const values: Record<string, number> = {
    'first-listen': input.songsPlayed,
    explorer: input.songsPlayed,
    'listener-10h': input.listeningMinutes,
    'playlist-maker': input.playlists,
    'artist-supporter': input.followedArtists,
    collector: input.favouriteSongs,
    ambassador: input.referrals,
  };
  return definitions.map(item => {
    const progress = Math.max(0, Number(values[item.id] || 0));
    return { ...item, progress: Math.min(progress, item.target), unlocked: progress >= item.target };
  });
}

export async function recordCommunityActivity(input: {
  uid: string;
  handle?: string;
  displayName?: string;
  type: string;
  title: string;
  description?: string;
  href?: string;
  artwork?: string;
  public?: boolean;
}) {
  await adminFirestore.collection('communityActivities').add({
    uid: input.uid,
    handle: communityHandle(input.handle),
    displayName: publicName(input.displayName),
    type: input.type,
    title: String(input.title || '').slice(0, 120),
    description: String(input.description || '').slice(0, 240),
    href: String(input.href || '').slice(0, 300),
    artwork: String(input.artwork || '').slice(0, 1000),
    public: input.public !== false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
