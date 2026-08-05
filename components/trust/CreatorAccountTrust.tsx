import Link from 'next/link';
import { BadgeCheck, BriefcaseBusiness, FileCheck2, Globe2, KeyRound, LockKeyhole, MailCheck, ShieldCheck, UserRoundCheck } from 'lucide-react';
import styles from './CreatorAccountTrust.module.css';

export function CreatorLicensingTrustPanel({ compact = false }: { compact?: boolean }) {
  return (
    <section data-trust-panel="creator-licensing" className={`${styles.panel} ${compact ? styles.compact : ''}`} aria-labelledby="creator-trust-title">
      <div className={styles.heading}>
        <span className={styles.icon}><BriefcaseBusiness size={21} /></span>
        <div><p>Creator licensing</p><h2 id="creator-trust-title">Clear rights for modern content.</h2></div>
      </div>
      <div className={styles.points}>
        <span><FileCheck2 size={16} /> Defined licence terms</span><span><BadgeCheck size={16} /> Official Aureon catalogue</span><span><Globe2 size={16} /> YouTube, podcasts and social media</span><span><ShieldCheck size={16} /> Licence access tied to your Creator plan</span>
      </div>
      <p className={styles.note}>Every commercial use remains subject to the published Aureon licence terms and the scope of your active plan.</p>
      <Link className={styles.link} href="/legal">Review licensing terms →</Link>
    </section>
  );
}

export function PrivacyFirstPanel() {
  return (
    <aside data-trust-panel="privacy-first" className={`${styles.panel} ${styles.privacy}`} aria-labelledby="privacy-first-title">
      <div className={styles.heading}><span className={styles.icon}><LockKeyhole size={21} /></span><div><p>Privacy first</p><h2 id="privacy-first-title">Your account remains yours.</h2></div></div>
      <div className={styles.points}><span><ShieldCheck size={16} /> Secure Firebase authentication</span><span><MailCheck size={16} /> Email verification and recovery</span><span><UserRoundCheck size={16} /> Public profile controls stay optional</span><span><LockKeyhole size={16} /> Payment details are never stored by Aureon</span></div>
      <p className={styles.note}>Aureon uses account information to provide memberships, playlists, recommendations and support. Public community sharing is always controlled separately.</p>
      <Link className={styles.link} href="/privacy">Read the Privacy Policy →</Link>
    </aside>
  );
}

export function AccountSecurityPanel({ emailVerified, billingProtected }: { emailVerified: boolean; billingProtected: boolean }) {
  return (
    <article data-trust-panel="account-security" className={`${styles.panel} ${styles.security}`} aria-labelledby="account-security-title">
      <div className={styles.heading}><span className={styles.icon}><ShieldCheck size={21} /></span><div><p>Account protection</p><h2 id="account-security-title">Security and privacy controls</h2></div></div>
      <div className={styles.securityGrid}><div><MailCheck size={18} /><span>Email verification</span><strong>{emailVerified ? 'Verified' : 'Action required'}</strong></div><div><KeyRound size={18} /><span>Password recovery</span><strong>Available</strong></div><div><LockKeyhole size={18} /><span>Authentication</span><strong>Encrypted</strong></div><div><ShieldCheck size={18} /><span>Billing protection</span><strong>{billingProtected ? 'Stripe secured' : 'No billing profile'}</strong></div></div>
      <p className={styles.note}>Use a unique password, keep your email verified and manage payment methods only through Aureon’s secure Stripe billing portal.</p>
      <div className={styles.actions}><Link className={styles.link} href="/privacy">Privacy controls →</Link><Link className={styles.link} href="/legal">Security terms →</Link></div>
    </article>
  );
}
