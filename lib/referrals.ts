import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { recordAnalyticsEvent } from '@/lib/analytics-server';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const monthKey = () => new Date().toISOString().slice(0, 7);
function codeFrom(uid: string) {
  let hash = 2166136261;
  for (const char of uid) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  let code = 'AUR';
  for (let i = 0; i < 7; i += 1) { code += alphabet[Math.abs(hash) % alphabet.length]; hash = Math.imul(hash ^ (i + 31), 16777619); }
  return code;
}

export async function ensureReferralProfile(uid: string, name = '') {
  const memberRef = adminFirestore.collection('members').doc(uid);
  const snap = await memberRef.get();
  const current = snap.data() || {};
  const referralCode = String(current.referralCode || codeFrom(uid));
  await memberRef.set({ referralCode, referralStats: current.referralStats || { invites: 0, signups: 0, conversions: 0, premiumDaysEarned: 0, points: 0 }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await adminFirestore.collection('referralCodes').doc(referralCode).set({ uid, name: name || current.name || 'Aureon Member', active: true, createdAt: current.referralCreatedAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return referralCode;
}

export async function claimReferral(referredUid: string, referralCode: string) {
  const code = referralCode.trim().toUpperCase();
  if (!code) return { claimed: false };
  const codeSnap = await adminFirestore.collection('referralCodes').doc(code).get();
  if (!codeSnap.exists || !codeSnap.data()?.active) throw new Error('Referral link is invalid or inactive.');
  const referrerUid = String(codeSnap.data()?.uid || '');
  if (!referrerUid || referrerUid === referredUid) throw new Error('You cannot refer your own account.');
  const referredRef = adminFirestore.collection('members').doc(referredUid);
  const referredSnap = await referredRef.get();
  if (referredSnap.data()?.referredByUid) return { claimed: false, alreadyClaimed: true };
  const referralRef = adminFirestore.collection('referrals').doc(referredUid);
  const batch = adminFirestore.batch();
  batch.set(referredRef, { referredByUid: referrerUid, referralCodeUsed: code, referralClaimedAt: FieldValue.serverTimestamp(), badges: FieldValue.arrayUnion('Aureon Insider'), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(referralRef, { referredUid, referrerUid, referralCode: code, status: 'signed_up', signupRewardGranted: true, conversionRewardGranted: false, month: monthKey(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminFirestore.collection('members').doc(referrerUid), { 'referralStats.signups': FieldValue.increment(1), 'referralStats.points': FieldValue.increment(100), badges: FieldValue.arrayUnion('Community Builder'), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await recordAnalyticsEvent({ eventType: 'referral_signup', entityType: 'referral', entityId: referredUid, memberId: referrerUid, referralCode: code });
  return { claimed: true };
}

export async function rewardReferralConversion(referredUid: string) {
  const referralRef = adminFirestore.collection('referrals').doc(referredUid);
  const snap = await referralRef.get();
  if (!snap.exists || snap.data()?.conversionRewardGranted) return { rewarded: false };
  const data = snap.data() || {};
  const referrerUid = String(data.referrerUid || '');
  if (!referrerUid || referrerUid === referredUid) return { rewarded: false };
  const premiumDays = 7;
  const batch = adminFirestore.batch();
  batch.set(referralRef, { status: 'converted', conversionRewardGranted: true, convertedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminFirestore.collection('members').doc(referrerUid), { 'referralStats.conversions': FieldValue.increment(1), 'referralStats.premiumDaysEarned': FieldValue.increment(premiumDays), 'referralStats.points': FieldValue.increment(500), referralPremiumDaysBalance: FieldValue.increment(premiumDays), badges: FieldValue.arrayUnion('Aureon Ambassador'), exclusiveContentUnlocked: FieldValue.arrayUnion('referral-ambassador-vault'), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminFirestore.collection('referralLeaderboard').doc(`${monthKey()}_${referrerUid}`), { uid: referrerUid, month: monthKey(), conversions: FieldValue.increment(1), points: FieldValue.increment(500), premiumDays: FieldValue.increment(premiumDays), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  await recordAnalyticsEvent({ eventType: 'referral_converted', entityType: 'referral', entityId: referredUid, memberId: referrerUid, referralCode: String(data.referralCode || ''), metadata: { premiumDays } });
  return { rewarded: true, referrerUid, premiumDays };
}
