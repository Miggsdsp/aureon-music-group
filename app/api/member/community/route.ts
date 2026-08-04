import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { memberError, requireMember } from '@/lib/member-server';
import { communityHandle, computeCommunityAchievements, publicName, recordCommunityActivity } from '@/lib/community';

export const runtime = 'nodejs';

type Row = { id: string; [key: string]: any };

function millis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function rows(path: FirebaseFirestore.CollectionReference, limit = 100): Promise<Row[]> {
  const snapshot = await path.limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function GET(request: Request) {
  try {
    const { uid, name, member } = await requireMember(request);
    const [playlists, following, favourites, collections, recentlyPlayed, referrals] = await Promise.all([
      rows(adminFirestore.collection('members').doc(uid).collection('playlists')),
      rows(adminFirestore.collection('members').doc(uid).collection('followingArtists')),
      rows(adminFirestore.collection('members').doc(uid).collection('favoriteSongs')),
      rows(adminFirestore.collection('members').doc(uid).collection('collections')),
      rows(adminFirestore.collection('members').doc(uid).collection('recentlyPlayed')),
      adminFirestore.collection('referrals').where('referrerUid', '==', uid).limit(100).get(),
    ]);

    const listeningSeconds = recentlyPlayed.reduce((sum, item) => sum + Number(item.progressSeconds || item.listenedSeconds || 0), 0);
    const songsPlayed = new Set(recentlyPlayed.map(item => String(item.songId || item.id))).size;
    const achievements = computeCommunityAchievements({
      songsPlayed,
      listeningMinutes: Math.floor(listeningSeconds / 60),
      playlists: playlists.length,
      followedArtists: following.length,
      favouriteSongs: favourites.length,
      referrals: referrals.docs.filter(doc => String(doc.data().status || '') === 'converted').length,
    });

    const handle = communityHandle(member.communityHandle || member.handle || name);
    const profile = {
      handle,
      displayName: publicName(member.communityDisplayName || member.name || name),
      bio: String(member.communityBio || ''),
      avatarUrl: String(member.communityAvatarUrl || member.photoURL || ''),
      favouriteGenres: Array.isArray(member.favouriteGenres) ? member.favouriteGenres : [],
      publicProfile: member.publicProfile === true,
      showListeningStats: member.showListeningStats !== false,
      showFollowing: member.showFollowing !== false,
      badges: Array.from(new Set([...(Array.isArray(member.badges) ? member.badges : []), ...achievements.filter(item => item.unlocked).map(item => item.title)])),
    };

    return NextResponse.json({
      profile,
      stats: {
        songsPlayed,
        listeningMinutes: Math.floor(listeningSeconds / 60),
        playlists: playlists.length,
        publicPlaylists: playlists.filter(item => item.isPublic === true).length,
        followedArtists: following.length,
        favouriteSongs: favourites.length,
        collections: collections.length,
      },
      playlists: playlists.sort((a, b) => millis(b.updatedAt || b.createdAt) - millis(a.updatedAt || a.createdAt)),
      following,
      favourites,
      collections,
      achievements,
    });
  } catch (error) {
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    const { uid, name, memberRef, member } = await requireMember(request);
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'update_profile') {
      const handle = communityHandle(body.handle);
      if (handle.length < 3) return NextResponse.json({ error: 'Choose a public handle with at least three characters.' }, { status: 400 });
      const handleRef = adminFirestore.collection('communityHandles').doc(handle);
      const currentHandle = communityHandle(member.communityHandle);
      await adminFirestore.runTransaction(async transaction => {
        const handleSnapshot = await transaction.get(handleRef);
        if (handleSnapshot.exists && String(handleSnapshot.data()?.uid || '') !== uid) throw new Error('HANDLE_TAKEN');
        transaction.set(handleRef, { uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        if (currentHandle && currentHandle !== handle) transaction.delete(adminFirestore.collection('communityHandles').doc(currentHandle));
        transaction.set(memberRef, {
          communityHandle: handle,
          communityDisplayName: publicName(body.displayName || name),
          communityBio: String(body.bio || '').trim().slice(0, 240),
          communityAvatarUrl: String(body.avatarUrl || '').trim().slice(0, 1000),
          favouriteGenres: Array.isArray(body.favouriteGenres) ? body.favouriteGenres.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 8) : [],
          publicProfile: body.publicProfile === true,
          showListeningStats: body.showListeningStats !== false,
          showFollowing: body.showFollowing !== false,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      await adminFirestore.collection('communityProfiles').doc(handle).set({
        uid,
        handle,
        displayName: publicName(body.displayName || name),
        bio: String(body.bio || '').trim().slice(0, 240),
        avatarUrl: String(body.avatarUrl || '').trim().slice(0, 1000),
        favouriteGenres: Array.isArray(body.favouriteGenres) ? body.favouriteGenres.slice(0, 8) : [],
        public: body.publicProfile === true,
        showListeningStats: body.showListeningStats !== false,
        showFollowing: body.showFollowing !== false,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ ok: true, handle });
    }

    if (action === 'playlist_visibility') {
      const playlistId = String(body.playlistId || '');
      if (!playlistId) return NextResponse.json({ error: 'Playlist required.' }, { status: 400 });
      const playlistRef = memberRef.collection('playlists').doc(playlistId);
      const playlistSnapshot = await playlistRef.get();
      if (!playlistSnapshot.exists) return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });
      const isPublic = body.isPublic === true;
      await playlistRef.set({ isPublic, description: String(body.description || '').slice(0, 180), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const data = playlistSnapshot.data() || {};
      if (isPublic) await recordCommunityActivity({ uid, handle: member.communityHandle, displayName: member.communityDisplayName || name, type: 'playlist_public', title: `Published ${String(data.name || 'a playlist')}`, description: String(body.description || ''), href: `/community/${communityHandle(member.communityHandle)}`, public: member.publicProfile === true });
      return NextResponse.json({ ok: true });
    }

    if (action === 'create_collection') {
      const title = String(body.title || '').trim().slice(0, 80);
      if (!title) return NextResponse.json({ error: 'Collection title required.' }, { status: 400 });
      const reference = await memberRef.collection('collections').add({ title, description: String(body.description || '').trim().slice(0, 180), itemIds: [], isPublic: body.isPublic === true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      if (body.isPublic === true) await recordCommunityActivity({ uid, handle: member.communityHandle, displayName: member.communityDisplayName || name, type: 'collection_created', title: `Created ${title}`, description: String(body.description || ''), href: `/community/${communityHandle(member.communityHandle)}`, public: member.publicProfile === true });
      return NextResponse.json({ ok: true, id: reference.id });
    }

    if (action === 'delete_collection') {
      const collectionId = String(body.collectionId || '');
      if (!collectionId) return NextResponse.json({ error: 'Collection required.' }, { status: 400 });
      await memberRef.collection('collections').doc(collectionId).delete();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported community action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'HANDLE_TAKEN') return NextResponse.json({ error: 'That community handle is already taken.' }, { status: 409 });
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
