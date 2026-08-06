import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { journeyContent, lifecycleRules, loadLifecycleMembers, sendLifecycleEmail, type LifecycleJourney } from '@/lib/lifecycle-email';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

async function latestRelease() {
  const [songs, albums] = await Promise.all([
    adminFirestore.collection('songs').where('status', '==', 'published').limit(80).get(),
    adminFirestore.collection('albums').where('status', '==', 'published').limit(40).get(),
  ]);
  const rows = [
    ...songs.docs.map(doc => ({ id: doc.id, type: 'song', ...doc.data() })),
    ...albums.docs.map(doc => ({ id: doc.id, type: 'album', ...doc.data() })),
  ] as Array<Record<string, unknown> & { id: string; type: string }>;
  return rows.sort((a, b) => lifecycleRules.millis(b.releaseDate || b.publishedAt || b.createdAt) - lifecycleRules.millis(a.releaseDate || a.publishedAt || a.createdAt))[0] || null;
}

async function recentArtistCount(uid: string) {
  const snapshot = await adminFirestore.collection('members').doc(uid).collection('recentlyPlayed').limit(30).get();
  return new Set(snapshot.docs.map(doc => String(doc.data().artistId || doc.data().artistName || '')).filter(Boolean)).size;
}

type ScheduledJourney = {
  journey: LifecycleJourney;
  key?: string;
  extra?: Record<string, string>;
};

async function runMember(member: Record<string, unknown> & { id: string }, release: Record<string, unknown> | null) {
  const now = Date.now();
  const createdDays = lifecycleRules.daysSince(member.createdAt || member.joinedAt, now);
  const lastActiveDays = lifecycleRules.daysSince(member.lastActivityAt || member.lastPlayedAt || member.updatedAt || member.createdAt, now);
  const journeys: ScheduledJourney[] = [];

  if (createdDays <= 1) journeys.push({ journey: 'welcome_1' });
  if (createdDays >= 2 && createdDays <= 3) journeys.push({ journey: 'welcome_2' });
  if (createdDays >= 5 && createdDays <= 7) journeys.push({ journey: 'welcome_3' });

  const genres = stringList(member.favouriteGenres);
  const profileComplete = genres.length > 0 && Boolean(member.communityDisplayName || member.name) && Boolean(member.communityHandle || member.handle);
  if (!profileComplete && createdDays >= 3) journeys.push({ journey: 'complete_profile', key: 'complete_profile_v1' });

  const knownArtistCount = Number(member.distinctArtistsPlayed || member.artistCount || member.listeningStats && (member.listeningStats as Record<string, unknown>).distinctArtists || 0);
  let artistCount = knownArtistCount;
  if (!artistCount && createdDays >= 4 && createdDays <= 30) artistCount = await recentArtistCount(member.id);
  if (createdDays >= 4 && artistCount < 2) journeys.push({ journey: 'discover_second_artist', key: 'discover_second_artist_v1' });

  const subscriptionActive = lifecycleRules.activePlan(member);
  const checkoutAge = lifecycleRules.daysSince(member.checkoutStartedAt || member.subscriptionCheckoutStartedAt, now);
  if (!subscriptionActive && checkoutAge >= 1 && checkoutAge <= 4) journeys.push({ journey: 'abandoned_subscription', key: `abandoned_${new Date(lifecycleRules.millis(member.checkoutStartedAt || member.subscriptionCheckoutStartedAt)).toISOString().slice(0, 10)}` });

  if (createdDays >= 7 && lastActiveDays <= 14 && (genres.length > 0 || Number(member.totalPlays || member.songsPlayed || 0) > 0)) {
    const month = new Date().toISOString().slice(0, 7);
    journeys.push({ journey: 'playlist_recommendation', key: `playlist_${month}` });
  }

  if (lastActiveDays >= 30) {
    const month = new Date().toISOString().slice(0, 7);
    journeys.push({ journey: 'inactive_reengagement', key: `inactive_${month}` });
  }

  if (createdDays >= 14 && Number(member.referralShares || member.referralsShared || 0) === 0) journeys.push({ journey: 'referral_invitation', key: 'referral_invitation_v1' });

  const renewalDays = lifecycleRules.daysUntil(member.currentPeriodEnd || member.subscriptionCurrentPeriodEnd || member.renewalDate, now);
  if (subscriptionActive && renewalDays >= 2 && renewalDays <= 4) {
    const end = lifecycleRules.millis(member.currentPeriodEnd || member.subscriptionCurrentPeriodEnd || member.renewalDate);
    journeys.push({ journey: 'membership_renewal', key: `renewal_${new Date(end).toISOString().slice(0, 10)}`, extra: { date: new Date(end).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }) } });
  }

  if (release) {
    const releaseTime = lifecycleRules.millis(release.releaseDate || release.publishedAt || release.createdAt);
    const releaseAge = releaseTime ? (now - releaseTime) / 86_400_000 : 999;
    const releaseArtist = String(release.artistName || release.artist || '');
    const followed = stringList(member.followedArtistIds || member.favouriteArtists);
    const relevant = !followed.length || followed.some(value => value.toLowerCase() === String(release.artistId || releaseArtist).toLowerCase());
    if (releaseAge >= 0 && releaseAge <= 3 && relevant) {
      const slug = String(release.slug || release.id);
      journeys.push({ journey: 'new_release', key: `new_release_${release.id}`, extra: { title: String(release.title || release.name || 'New Aureon release'), artist: releaseArtist, href: release.type === 'album' ? `/albums/${slug}` : `/songs/${slug}` } });
    }
  }

  const outcomes: Array<Record<string, unknown>> = [];
  for (const item of journeys.slice(0, 2)) {
    const journey: LifecycleJourney = item.journey;
    const content = journeyContent(journey, member, item.extra ?? {});
    try {
      const delivery = await sendLifecycleEmail(member, journey, content, item.key ?? journey);
      outcomes.push({ journey, ...delivery });
    } catch (error) {
      outcomes.push({ journey, sent: false, reason: error instanceof Error ? error.message : 'send_failed' });
    }
  }
  return outcomes;
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [members, release] = await Promise.all([loadLifecycleMembers(300), latestRelease()]);
  const results: Array<{ uid: string; outcomes: unknown[] }> = [];
  let sent = 0;
  for (const member of members) {
    const outcomes = await runMember(member, release);
    sent += outcomes.filter(item => item.sent === true).length;
    if (outcomes.length) results.push({ uid: member.id, outcomes });
  }
  await adminFirestore.collection('lifecycleRuns').add({ processed: members.length, matched: results.length, sent, releaseId: release?.id || null, completedAt: new Date() });
  return NextResponse.json({ ok: true, processed: members.length, matched: results.length, sent });
}
