import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { memberError, requireMember } from '@/lib/member-server';
import { claimReferral, ensureReferralProfile } from '@/lib/referrals';
import { recordAnalyticsEvent } from '@/lib/analytics-server';

export const runtime = 'nodejs';
const monthKey = () => new Date().toISOString().slice(0, 7);
const safeName = (value: unknown) => String(value || 'Aureon Member').trim().slice(0, 80);

export async function GET(request: Request) {
  try {
    const { uid } = await requireMember(request);
    const memberRef = adminFirestore.collection('members').doc(uid);
    const memberSnap = await memberRef.get();
    const member = memberSnap.data() || {};
    const referralCode = await ensureReferralProfile(uid, safeName(member.name));
    const referrals = await adminFirestore.collection('referrals').where('referrerUid', '==', uid).get();
    const rows = referrals.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => String(b.createdAt?.toDate?.()?.toISOString?.() || '').localeCompare(String(a.createdAt?.toDate?.()?.toISOString?.() || ''))).slice(0, 50);
    const leaderboardSnap = await adminFirestore.collection('referralLeaderboard').where('month', '==', monthKey()).get();
    const leaders = leaderboardSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => Number(b.points || 0) - Number(a.points || 0)).slice(0, 10);
    const names = await Promise.all(leaders.map(async (leader: any) => {
      const snap = await adminFirestore.collection('members').doc(String(leader.uid || '')).get();
      return { ...leader, name: safeName(snap.data()?.name) };
    }));
    return NextResponse.json({
      referralCode,
      referralUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com'}/account?ref=${referralCode}&mode=signup`,
      stats: member.referralStats || { invites: 0, signups: 0, conversions: 0, premiumDaysEarned: 0, points: 0 },
      premiumDaysBalance: Number(member.referralPremiumDaysBalance || 0),
      badges: Array.isArray(member.badges) ? member.badges : [],
      exclusiveContent: Array.isArray(member.exclusiveContentUnlocked) ? member.exclusiveContentUnlocked : [],
      referrals: rows,
      leaderboard: names,
      month: monthKey(),
      rewards: { signupPoints: 100, conversionPoints: 500, conversionPremiumDays: 7 },
    });
  } catch (error) {
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireMember(request);
    const body = await request.json();
    const action = String(body?.action || '');
    if (action === 'claim') return NextResponse.json(await claimReferral(uid, String(body?.referralCode || '')));
    if (action === 'share') {
      const member = await adminFirestore.collection('members').doc(uid).get();
      const referralCode = await ensureReferralProfile(uid, safeName(member.data()?.name));
      await adminFirestore.collection('members').doc(uid).set({ 'referralStats.invites': FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await recordAnalyticsEvent({ eventType: 'referral_shared', entityType: 'referral', entityId: uid, memberId: uid, referralCode, metadata: { channel: String(body?.channel || 'copy') } });
      return NextResponse.json({ shared: true });
    }
    return NextResponse.json({ error: 'Unsupported referral action.' }, { status: 400 });
  } catch (error) {
    const result = memberError(error);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
}
