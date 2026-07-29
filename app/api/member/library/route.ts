import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

function serialiseDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  try {
    const context = await requireMember(request);
    if (!hasActivePlan(context.member)) return NextResponse.json({ error: 'An active membership is required.' }, { status: 403 });

    const [recentSnapshot, downloadsSnapshot] = await Promise.all([
      context.memberRef.collection('recentlyPlayed').orderBy('playedAt', 'desc').limit(20).get(),
      context.memberRef.collection('downloadHistory').orderBy('createdAt', 'desc').limit(50).get(),
    ]);

    return NextResponse.json({
      favouriteSongIds: Array.isArray(context.member.favouriteSongIds) ? context.member.favouriteSongIds : [],
      favouriteArtists: Array.isArray(context.member.favouriteArtists) ? context.member.favouriteArtists : [],
      continueListening: context.member.continueListening || null,
      recentlyPlayed: recentSnapshot.docs.map(item => ({ id: item.id, ...item.data(), playedAt: serialiseDate(item.data().playedAt) })),
      downloadHistory: downloadsSnapshot.docs.map(item => ({ id: item.id, ...item.data(), createdAt: serialiseDate(item.data().createdAt) })),
      downloadsUsed: Number(context.member.monthlyDownloadsUsed || 0),
      downloadLimit: Number(context.member.monthlyDownloadLimit || 5),
      resetDate: serialiseDate(context.member.currentPeriodEnd),
    });
  } catch (error) {
    console.error('Member library read failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireMember(request);
    if (!hasActivePlan(context.member)) return NextResponse.json({ error: 'An active membership is required.' }, { status: 403 });
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'toggle-song') {
      const songId = String(body?.songId || '').trim();
      if (!songId) return NextResponse.json({ error: 'Song is required.' }, { status: 400 });
      const current = Array.isArray(context.member.favouriteSongIds) ? context.member.favouriteSongIds.map(String) : [];
      const active = !current.includes(songId);
      await context.memberRef.set({ favouriteSongIds: active ? FieldValue.arrayUnion(songId) : FieldValue.arrayRemove(songId), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ active });
    }

    if (action === 'toggle-artist') {
      const artist = String(body?.artist || '').trim();
      if (!artist) return NextResponse.json({ error: 'Artist is required.' }, { status: 400 });
      const current = Array.isArray(context.member.favouriteArtists) ? context.member.favouriteArtists.map(String) : [];
      const active = !current.includes(artist);
      await context.memberRef.set({ favouriteArtists: active ? FieldValue.arrayUnion(artist) : FieldValue.arrayRemove(artist), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ active });
    }

    if (action === 'played' || action === 'progress') {
      const songId = String(body?.songId || '').trim();
      if (!songId) return NextResponse.json({ error: 'Song is required.' }, { status: 400 });
      const song = {
        songId,
        title: String(body?.title || ''),
        artist: String(body?.artist || ''),
        coverImageUrl: String(body?.coverImageUrl || ''),
        progressSeconds: Math.max(0, Number(body?.progressSeconds || 0)),
        durationSeconds: Math.max(0, Number(body?.durationSeconds || 0)),
      };
      if (action === 'played') {
        await context.memberRef.collection('recentlyPlayed').doc(songId).set({ ...song, playedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      await context.memberRef.set({ continueListening: { ...song, updatedAt: new Date().toISOString() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ saved: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Member library update failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
