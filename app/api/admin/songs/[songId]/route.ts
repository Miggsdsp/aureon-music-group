import { NextResponse } from 'next/server';
import { FieldValue, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore';
import { adminFirestore, adminStorage } from '@/lib/firebase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';
import { canAccessSection, canWrite, isAdminRole } from '@/lib/admin-permissions';

export const runtime = 'nodejs';

type Context = { params: Promise<{ songId: string }> };

type PendingWrite =
  | { type: 'update'; ref: DocumentReference; data: Record<string, unknown> }
  | { type: 'delete'; ref: DocumentReference };

function directPath(value: unknown, allowedPrefix: string) {
  const path = String(value || '').trim();
  return path.startsWith(allowedPrefix) ? path : '';
}

function pathFromDownloadUrl(value: unknown, allowedPrefix: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith(allowedPrefix)) return raw;
  try {
    const url = new URL(raw);
    const marker = '/o/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return '';
    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    const path = decodeURIComponent(encodedPath);
    return path.startsWith(allowedPrefix) ? path : '';
  } catch {
    return '';
  }
}

async function commitWrites(writes: PendingWrite[]) {
  const chunkSize = 400;
  for (let start = 0; start < writes.length; start += chunkSize) {
    const batch: WriteBatch = adminFirestore.batch();
    for (const write of writes.slice(start, start + chunkSize)) {
      if (write.type === 'delete') batch.delete(write.ref);
      else batch.update(write.ref, write.data);
    }
    await batch.commit();
  }
}

function storageBucket() {
  const bucketName = process.env.FIREBASE_ADMIN_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
}

export async function DELETE(request: Request, context: Context) {
  try {
    const admin = await requireAdminApi(request);
    const role = admin.profile?.role;
    if (!isAdminRole(role) || !canAccessSection(role, 'songs') || !canWrite(role)) {
      return NextResponse.json({ error: 'You do not have permission to delete songs.' }, { status: 403 });
    }

    const { songId } = await context.params;
    const songRef = adminFirestore.collection('songs').doc(songId);
    const songSnapshot = await songRef.get();
    if (!songSnapshot.exists) return NextResponse.json({ error: 'Song not found.' }, { status: 404 });

    const song = songSnapshot.data() || {};
    const details = song.details && typeof song.details === 'object' ? song.details as Record<string, unknown> : {};

    const storagePaths = new Set<string>();
    const masterPath = directPath(song.privateFilePath || details.privateFilePath || song.fullTrackPath || details.fullTrackPath, 'private/full-tracks/');
    const streamPath = directPath(song.streamFilePath || details.streamFilePath, 'private/streams/');
    const previewPath = pathFromDownloadUrl(song.previewUrl || details.previewUrl, 'public/previews/');
    const coverPath = pathFromDownloadUrl(song.coverImageUrl || details.coverImageUrl, 'public/songs/covers/');
    [masterPath, streamPath, previewPath, coverPath].filter(Boolean).forEach(path => storagePaths.add(path));

    let storageObjectsDeleted = 0;
    const bucket = storageBucket();
    for (const path of storagePaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      await file.delete();
      storageObjectsDeleted += 1;
    }

    const [favouriteMembers, continueMembers, allPlaylists, allRecent] = await Promise.all([
      adminFirestore.collection('members').where('favouriteSongIds', 'array-contains', songId).get(),
      adminFirestore.collection('members').where('continueListening.songId', '==', songId).get(),
      adminFirestore.collectionGroup('playlists').get(),
      adminFirestore.collectionGroup('recentlyPlayed').get(),
    ]);

    const playlistRefs = allPlaylists.docs.filter(item => {
      const ids = item.get('songIds');
      return Array.isArray(ids) && ids.includes(songId);
    });
    const recentRefs = allRecent.docs.filter(item => item.get('songId') === songId);

    const memberUpdates = new Map<string, { ref: DocumentReference; data: Record<string, unknown> }>();
    for (const member of favouriteMembers.docs) {
      memberUpdates.set(member.ref.path, {
        ref: member.ref,
        data: { favouriteSongIds: FieldValue.arrayRemove(songId), updatedAt: FieldValue.serverTimestamp() },
      });
    }
    for (const member of continueMembers.docs) {
      const existing = memberUpdates.get(member.ref.path);
      memberUpdates.set(member.ref.path, {
        ref: member.ref,
        data: { ...(existing?.data || {}), continueListening: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
      });
    }

    const writes: PendingWrite[] = [
      ...Array.from(memberUpdates.values()).map(item => ({ type: 'update' as const, ref: item.ref, data: item.data })),
      ...playlistRefs.map(item => ({ type: 'update' as const, ref: item.ref, data: { songIds: FieldValue.arrayRemove(songId), updatedAt: FieldValue.serverTimestamp() } })),
      ...recentRefs.map(item => ({ type: 'delete' as const, ref: item.ref })),
      { type: 'delete' as const, ref: songRef },
    ];

    await commitWrites(writes);

    return NextResponse.json({
      ok: true,
      songId,
      storageObjectsDeleted,
      storagePathsChecked: storagePaths.size,
      memberReferencesCleaned: memberUpdates.size + playlistRefs.length + recentRefs.length,
      retainedHistoricalRecords: true,
    });
  } catch (error) {
    console.error('Song deletion failed:', error);
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401 });
    if (code === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
    return NextResponse.json({ error: 'Aureon could not delete the song completely. Check the server log for the failing cleanup step and try again.' }, { status: 500 });
  }
}
