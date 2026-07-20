import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { hasActivePlan, memberError, requireMember } from '@/lib/member-server';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ songId: string }> }) {
  try {
    const memberContext = await requireMember(request);
    if (!hasActivePlan(memberContext.member, 'creator')) {
      return NextResponse.json({ error: 'An active Aureon Creator membership is required.' }, { status: 403 });
    }

    const { songId } = await context.params;
    const song = await adminFirestore.collection('songs').doc(songId).get();
    if (!song.exists || song.data()?.status !== 'published') return NextResponse.json({ error: 'Song not found.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const projectName = String(body.projectName || '').trim().slice(0, 160);
    const useType = String(body.useType || 'Online content').trim().slice(0, 80);
    if (!projectName) return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });

    const reference = `AUR-LIC-${Date.now().toString(36).toUpperCase()}-${memberContext.uid.slice(0, 5).toUpperCase()}`;
    const licenceRef = adminFirestore.collection('licenses').doc(reference);
    await licenceRef.set({
      reference,
      uid: memberContext.uid,
      memberEmail: memberContext.email,
      songId,
      songTitle: song.data()?.title || '',
      artistName: song.data()?.artistName || song.data()?.artist || 'Aureon Music Group',
      projectName,
      useType,
      plan: 'creator',
      status: 'active',
      validWhileSubscriptionActive: true,
      stripeSubscriptionId: memberContext.member.stripeSubscriptionId || '',
      issuedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      reference,
      status: 'active',
      terms: 'This licence remains valid only while the associated Aureon Creator subscription remains active and the use stays within Aureon Creator licence limits.',
    });
  } catch (error) {
    console.error('Creator licence generation failed:', error);
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
