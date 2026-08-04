import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  const secret = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const month = previousMonth();
  const finalRef = adminFirestore.collection('referralMonthlyRewards').doc(month);
  const existing = await finalRef.get();
  if (existing.exists) return NextResponse.json({ month, alreadyFinalised: true });

  const snapshot = await adminFirestore.collection('referralLeaderboard').where('month', '==', month).get();
  const leaders = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
    .slice(0, 3);
  const prizes = [30, 14, 7];
  const badges = ['Referral Champion', 'Referral Finalist', 'Referral Rising Star'];

  const batch = adminFirestore.batch();
  leaders.forEach((leader, index) => {
    const uid = String(leader.uid || '');
    if (!uid) return;
    batch.set(adminFirestore.collection('members').doc(uid), {
      referralPremiumDaysBalance: FieldValue.increment(prizes[index]),
      badges: FieldValue.arrayUnion(badges[index]),
      exclusiveContentUnlocked: FieldValue.arrayUnion(`monthly-referral-${month}`),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  batch.set(finalRef, {
    month,
    winners: leaders.map((leader, index) => ({ uid: leader.uid, rank: index + 1, points: Number(leader.points || 0), premiumDays: prizes[index], badge: badges[index] })),
    finalisedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return NextResponse.json({ month, winners: leaders.length });
}
