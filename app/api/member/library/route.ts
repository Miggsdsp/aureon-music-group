import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';
const CONTINUE_LISTENING_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function serialiseDate(value: any) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function billingCycleKey(member: Record<string, any>) {
  const value = member.currentPeriodEnd;
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (date && !Number.isNaN(date.getTime())) return `cycle-${date.toISOString().slice(0, 10)}`;
  const now = new Date();
  return `cycle-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function activeContinueListening(member: Record<string, any>) {
  const item = member.continueListening;
  if (!item?.songId) return null;
  const updated = new Date(item.updatedAt || 0);
  const expires = new Date(item.expiresAt || (updated.getTime() + CONTINUE_LISTENING_TTL_MS));
  if (Number.isNaN(expires.getTime()) || expires.getTime() <= Date.now()) return null;
  return {
    ...item,
    progressSeconds: Math.max(0, Number(item.progressSeconds || 0)),
    durationSeconds: Math.max(0, Number(item.durationSeconds || 0)),
    progressPercent: Math.max(0, Math.min(100, Number(item.progressPercent || 0))),
    updatedAt: serialiseDate(item.updatedAt),
    expiresAt: serialiseDate(item.expiresAt || expires),
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireMember(request);
    if (!hasActivePlan(context.member)) return NextResponse.json({ error: 'An active membership is required.' }, { status: 403 });

    const cycle = billingCycleKey(context.member);
    const [recentSnapshot, downloadsSnapshot, usageSnapshot] = await Promise.all([
      context.memberRef.collection('recentlyPlayed').orderBy('playedAt', 'desc').limit(20).get(),
      context.memberRef.collection('downloadHistory').orderBy('createdAt', 'desc').limit(50).get(),
      context.memberRef.collection('downloadUsage').doc(cycle).get(),
    ]);
    const downloadsUsed = Number(usageSnapshot.data()?.count || 0);
    const continueListening = activeContinueListening(context.member);
    if (!continueListening && context.member.continueListening) {
      await context.memberRef.set({ continueListening: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return NextResponse.json({
      favouriteSongIds: Array.isArray(context.member.favouriteSongIds) ? context.member.favouriteSongIds : [],
      favouriteArtists: Array.isArray(context.member.favouriteArtists) ? context.member.favouriteArtists : [],
      continueListening,
      recentlyPlayed: recentSnapshot.docs.map(item => ({ id: item.id, ...item.data(), playedAt: serialiseDate(item.data().playedAt) })),
      downloadHistory: downloadsSnapshot.docs.map(item => ({ id: item.id, ...item.data(), createdAt: serialiseDate(item.data().createdAt) })),
      downloadsUsed,
      downloadLimit: 5,
      downloadCycle: cycle,
      resetDate: serialiseDate(context.member.currentPeriodEnd),
    }, { headers: { 'Cache-Control': 'no-store' } });
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
      const progressSeconds = Math.max(0, Number(body?.progressSeconds || 0));
      const durationSeconds = Math.max(0, Number(body?.durationSeconds || 0));
      const progressPercent = durationSeconds > 0 ? Math.max(0, Math.min(100, progressSeconds / durationSeconds * 100)) : 0;
      const now = new Date();
      const song = {
        songId,
        title: String(body?.title || ''),
        artist: String(body?.artist || ''),
        coverImageUrl: String(body?.coverImageUrl || ''),
        progressSeconds,
        durationSeconds,
        progressPercent: Number(progressPercent.toFixed(2)),
      };
      if (action === 'played') await context.memberRef.collection('recentlyPlayed').doc(songId).set({ ...song, playedAt: FieldValue.serverTimestamp() }, { merge: true });
      const completed = durationSeconds > 0 && (progressPercent >= 98 || durationSeconds - progressSeconds <= 5);
      await context.memberRef.set({
        continueListening: completed ? FieldValue.delete() : {
          ...song,
          updatedAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + CONTINUE_LISTENING_TTL_MS).toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ saved: true, completed, progressPercent });
    }

    if (action === 'clear-progress') {
      await context.memberRef.set({ continueListening: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({ cleared: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Member library update failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
