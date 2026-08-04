import { createHmac, timingSafeEqual } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aureonmusicgroup.com';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Aureon Music Group <members@aureonmusicgroup.com>';
const SECRET = process.env.LIFECYCLE_EMAIL_SECRET || process.env.CRON_SECRET || '';

export type LifecycleJourney =
  | 'welcome_1' | 'welcome_2' | 'welcome_3'
  | 'complete_profile' | 'discover_second_artist'
  | 'new_release' | 'abandoned_subscription'
  | 'playlist_recommendation' | 'inactive_reengagement'
  | 'referral_invitation' | 'membership_renewal';

type MemberRow = Record<string, unknown> & { id: string };
type EmailContent = { subject: string; preheader: string; heading: string; body: string; cta: string; href: string };

function millis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toMillis();
  const maybe = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
  if (typeof maybe.toMillis === 'function') return maybe.toMillis();
  if (typeof maybe.toDate === 'function') return maybe.toDate().getTime();
  if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(value: unknown, now = Date.now()) { const time = millis(value); return time ? Math.floor((now - time) / 86_400_000) : 9999; }
function daysUntil(value: unknown, now = Date.now()) { const time = millis(value); return time ? Math.ceil((time - now) / 86_400_000) : 9999; }
function text(value: unknown) { return String(value || '').trim(); }
function firstName(member: MemberRow) { return text(member.name || member.displayName).split(/\s+/)[0] || 'Music Lover'; }
function activePlan(member: MemberRow) { return ['active', 'trialing'].includes(text(member.subscriptionStatus).toLowerCase()); }

export function unsubscribeToken(uid: string) {
  if (!SECRET) return '';
  return createHmac('sha256', SECRET).update(`lifecycle:${uid}`).digest('hex');
}

export function verifyUnsubscribeToken(uid: string, token: string) {
  const expected = unsubscribeToken(uid);
  if (!expected || expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

function layout(member: MemberRow, content: EmailContent) {
  const token = unsubscribeToken(member.id);
  const unsubscribe = `${SITE_URL}/api/email/unsubscribe?uid=${encodeURIComponent(member.id)}&token=${encodeURIComponent(token)}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>${content.subject}</title></head><body style="margin:0;background:#050505;color:#f7f2e8;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${content.preheader}</div><table width="100%" cellspacing="0" cellpadding="0" style="background:#050505"><tr><td align="center" style="padding:36px 16px"><table width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;border:1px solid #5b4722;background:#0b0a08"><tr><td style="padding:30px 38px;border-bottom:1px solid #5b4722;text-align:center"><div style="font-size:28px;letter-spacing:8px;color:#d9ae4d;font-family:Georgia,serif">AUREON</div><div style="margin-top:8px;font-size:10px;letter-spacing:4px;color:#b89755">MUSIC GROUP</div></td></tr><tr><td style="padding:42px 38px"><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#d9ae4d">Creating Tomorrow’s Classics</div><h1 style="font-family:Georgia,serif;font-size:34px;line-height:1.15;margin:18px 0;color:#fff5dc">${content.heading}</h1><p style="font-size:16px;line-height:1.75;color:#d8d0c0;margin:0 0 28px">${content.body}</p><a href="${SITE_URL}${content.href}" style="display:inline-block;border:1px solid #d9ae4d;padding:15px 24px;color:#f2c862;text-decoration:none;text-transform:uppercase;letter-spacing:2px;font-size:12px">${content.cta} →</a></td></tr><tr><td style="padding:24px 38px;border-top:1px solid #302719;font-size:11px;line-height:1.6;color:#81796c">You are receiving this because you created an Aureon account or asked to hear from us.<br><a href="${unsubscribe}" style="color:#b89755">Unsubscribe from lifecycle and marketing emails</a></td></tr></table></td></tr></table></body></html>`;
}

export async function sendLifecycleEmail(member: MemberRow, journey: LifecycleJourney, content: EmailContent, dedupeKey = journey) {
  const email = text(member.email);
  if (!email || member.marketingEmailsDisabled === true || !process.env.RESEND_API_KEY) return { sent: false, reason: 'not_eligible' };
  const deliveryId = `${member.id}_${dedupeKey}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 500);
  const deliveryRef = adminFirestore.collection('lifecycleDeliveries').doc(deliveryId);
  if ((await deliveryRef.get()).exists) return { sent: false, reason: 'duplicate' };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: content.subject, html: layout(member, content), tags: [{ name: 'journey', value: journey }] }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  const result = await response.json() as { id?: string };
  await deliveryRef.set({ uid: member.id, email, journey, dedupeKey, resendId: result.id || '', sentAt: FieldValue.serverTimestamp() });
  await adminFirestore.collection('lifecycleMetrics').doc(journey).set({ sent: FieldValue.increment(1), lastSentAt: FieldValue.serverTimestamp() }, { merge: true });
  return { sent: true, id: result.id };
}

export function journeyContent(journey: LifecycleJourney, member: MemberRow, extra: Record<string, string> = {}): EmailContent {
  const name = firstName(member);
  const map: Record<LifecycleJourney, EmailContent> = {
    welcome_1: { subject: 'Welcome to Aureon Music Group', preheader: 'Your Aureon music journey begins now.', heading: `Welcome to Aureon, ${name}.`, body: 'Your account is ready. Discover original music, follow artists, save favourites and begin shaping a listening experience that becomes more personal with every play.', cta: 'Start listening', href: '/discover' },
    welcome_2: { subject: 'Make Aureon yours', preheader: 'Choose your genres and artists.', heading: 'A more personal sound awaits.', body: 'Choose the genres and artists that move you. Aureon uses these signals to create recommendations, playlists and discoveries designed around your taste.', cta: 'Complete your profile', href: '/account' },
    welcome_3: { subject: 'Your next Aureon discovery', preheader: 'Go beyond your first artist.', heading: 'There is more waiting to be heard.', body: 'Every artist opens a different corner of the Aureon catalogue. Discover your next sound and let your personal recommendations evolve.', cta: 'Discover artists', href: '/artists' },
    complete_profile: { subject: 'Complete your Aureon profile', preheader: 'Improve your recommendations in a few moments.', heading: 'Help Aureon understand your sound.', body: 'Add your favourite genres, follow artists and complete your profile to unlock more relevant recommendations and community features.', cta: 'Complete profile', href: '/account' },
    discover_second_artist: { subject: 'Ready to discover your second artist?', preheader: 'Your next favourite may already be here.', heading: 'One artist is only the beginning.', body: 'Explore another Aureon artist to broaden your recommendations and uncover music you may not have expected to love.', cta: 'Meet the artists', href: '/artists' },
    new_release: { subject: `New from Aureon: ${extra.title || 'a new release'}`, preheader: 'Fresh music has arrived.', heading: extra.title || 'A new Aureon release has arrived.', body: `${extra.artist ? `${extra.artist} presents ` : ''}${extra.title || 'a new release'}—now available to discover on Aureon.`, cta: 'Hear the release', href: extra.href || '/music' },
    abandoned_subscription: { subject: 'Your Aureon Premium journey is waiting', preheader: 'Return to uninterrupted listening.', heading: 'Continue where you left off.', body: 'You explored Aureon Premium but did not complete membership. Return when you are ready for full-track listening, exclusive releases and a continuously growing catalogue.', cta: 'Explore Premium', href: '/membership' },
    playlist_recommendation: { subject: 'A playlist selected for you', preheader: 'Aureon has a listening session ready.', heading: extra.title || 'Your next listening session is ready.', body: 'Based on your recent listening and favourite genres, this Aureon mix is designed for the way you listen right now.', cta: 'Open your recommendations', href: '/discover' },
    inactive_reengagement: { subject: 'Your Aureon soundtrack has evolved', preheader: 'New music and recommendations are waiting.', heading: `Come back to the music, ${name}.`, body: 'New releases, fresh playlists and more personal recommendations have arrived since your last visit. Your listening journey is ready to continue.', cta: 'Return to Aureon', href: '/discover' },
    referral_invitation: { subject: 'Share Aureon. Earn Premium time.', preheader: 'Invite friends and unlock rewards.', heading: 'Music is better when it is shared.', body: 'Your personal Aureon referral link is ready. Invite friends, earn Premium time, unlock badges and rise through the monthly ambassador leaderboard.', cta: 'Open referral dashboard', href: '/account' },
    membership_renewal: { subject: 'Your Aureon membership renews soon', preheader: 'A reminder about your upcoming renewal.', heading: 'Your uninterrupted listening continues.', body: `Your Aureon membership is scheduled to renew ${extra.date ? `on ${extra.date}` : 'soon'}. You can review your membership and billing details at any time.`, cta: 'Manage membership', href: '/account' },
  };
  return map[journey];
}

export async function loadLifecycleMembers(limit = 500): Promise<MemberRow[]> {
  const snapshot = await adminFirestore.collection('members').limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export const lifecycleRules = { millis, daysSince, daysUntil, text, activePlan };
