import Link from 'next/link';
import styles from './HomeMembershipCta.module.css';

export function HomeMembershipCta() {
  return (
    <section className={styles.section} aria-labelledby="home-membership-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Stay with the music</p>
        <h2 id="home-membership-title">Your next favourite is waiting.</h2>
        <p>Explore the Aureon catalogue, find the sounds that stay with you, and choose the membership that fits your listening or creating.</p>
      </div>
      <div className={styles.actions}>
        <Link href="/membership" className={styles.primary}>Explore membership <span aria-hidden="true">→</span></Link>
        <Link href="/music" className={styles.secondary}>Keep discovering</Link>
      </div>
    </section>
  );
}
