'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Award, Check, Copy, Crown, Gift, Share2, Sparkles, Trophy, Users } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebase-client';
import styles from './ReferralDashboard.module.css';

type Data = {
  referralCode: string;
  referralUrl: string;
  stats: { invites?: number; signups?: number; conversions?: number; premiumDaysEarned?: number; points?: number };
  premiumDaysBalance: number;
  badges: string[];
  exclusiveContent: string[];
  referrals: Array<{ id: string; status?: string; createdAt?: any }>;
  leaderboard: Array<{ uid: string; name: string; points?: number; conversions?: number; premiumDays?: number }>;
  month: string;
  rewards: { signupPoints: number; conversionPoints: number; conversionPremiumDays: number };
};

export function ReferralDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const user = firebaseAuth.currentUser;
    if (!user) { setData(null); setLoading(false); return; }
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/member/referrals', { headers: { authorization: `Bearer ${token}` } });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to load referrals.');
      setData(json);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load referrals.'); }
    finally { setLoading(false); }
  }

  useEffect(() => onAuthStateChanged(firebaseAuth, user => { if (user) void load(); else { setData(null); setLoading(false); } }), []);

  async function recordShare(channel: string) {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/member/referrals', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'share', channel }) });
  }

  async function copyLink() {
    if (!data) return;
    await navigator.clipboard.writeText(data.referralUrl);
    await recordShare('copy');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    if (!data) return;
    const payload = { title: 'Join Aureon Music Group', text: 'Discover premium original music with Aureon. Join through my invitation.', url: data.referralUrl };
    if (navigator.share) { await navigator.share(payload); await recordShare('native'); }
    else await copyLink();
  }

  if (loading) return <section className={styles.shell}><p>Loading your referral programme…</p></section>;
  if (!data) return null;

  const stats = data.stats || {};
  return <section className={styles.shell} aria-labelledby="referral-title">
    <div className={styles.heading}><div><p className={styles.kicker}>Aureon Rewards</p><h2 id="referral-title">Invite friends. Build the movement.</h2><p>Share Aureon with people who love music. Verified referrals unlock Premium time, badges and exclusive content.</p></div><div className={styles.balance}><Gift/><span>Premium reward balance</span><strong>{data.premiumDaysBalance} days</strong></div></div>

    {message && <p className={styles.message}>{message}</p>}
    <div className={styles.linkCard}><div><span>Your personal referral link</span><strong>{data.referralCode}</strong><small>{data.referralUrl}</small></div><div className={styles.actions}><button onClick={copyLink}>{copied ? <Check/> : <Copy/>}{copied ? 'Copied' : 'Copy link'}</button><button className={styles.primary} onClick={share}><Share2/>Share invitation</button></div></div>

    <div className={styles.stats}>
      <article><Users/><span>Invites shared</span><strong>{Number(stats.invites || 0)}</strong></article>
      <article><Sparkles/><span>Accounts created</span><strong>{Number(stats.signups || 0)}</strong></article>
      <article><Crown/><span>Paid referrals</span><strong>{Number(stats.conversions || 0)}</strong></article>
      <article><Award/><span>Reward points</span><strong>{Number(stats.points || 0).toLocaleString()}</strong></article>
    </div>

    <div className={styles.grid}>
      <article className={styles.panel}><h3><Gift/> How rewards work</h3><div className={styles.reward}><strong>Friend creates an account</strong><span>+{data.rewards.signupPoints} points and Community Builder progress</span></div><div className={styles.reward}><strong>Friend becomes a paid member</strong><span>+{data.rewards.conversionPoints} points, {data.rewards.conversionPremiumDays} Premium days and Ambassador access</span></div><p className={styles.note}>Rewards are granted only after verified account and Stripe subscription events. Self-referrals and duplicate claims are blocked.</p></article>
      <article className={styles.panel}><h3><Award/> Badges & access</h3>{data.badges.length ? <div className={styles.badges}>{data.badges.map(badge => <span key={badge}>{badge}</span>)}</div> : <p>No badges unlocked yet.</p>}{data.exclusiveContent.length ? <div className={styles.unlock}><Sparkles/><span>Exclusive Ambassador content unlocked</span></div> : <p className={styles.note}>Your first paid referral unlocks the Aureon Ambassador vault.</p>}</article>
    </div>

    <div className={styles.grid}>
      <article className={styles.panel}><h3><Users/> Referral activity</h3>{data.referrals.length ? <ul className={styles.list}>{data.referrals.slice(0, 10).map((item, index) => <li key={item.id}><span>Referral {index + 1}</span><strong>{item.status === 'converted' ? 'Premium member' : 'Account created'}</strong></li>)}</ul> : <p>No referrals yet. Share your link to begin.</p>}</article>
      <article className={styles.panel}><h3><Trophy/> Monthly leaderboard</h3><p className={styles.note}>{data.month}</p>{data.leaderboard.length ? <ol className={styles.leaderboard}>{data.leaderboard.map((leader, index) => <li key={leader.uid}><span className={styles.rank}>{index + 1}</span><strong>{leader.name}</strong><span>{Number(leader.points || 0).toLocaleString()} pts</span></li>)}</ol> : <p>The leaderboard is waiting for its first ambassador.</p>}</article>
    </div>
  </section>;
}
