import Link from 'next/link';
import styles from './HomeMembershipCta.module.css';

export function HomeMembershipCta() {
  return (
    <section className={styles.section} aria-labelledby="home-membership-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Stay with the music</p>
        <h2 id="home-membership-title">Discover Music Worth Coming Back To.</h2>
        <p>Explore country, reggae, Latin pop, Afrobeats, deep house and contemporary pop from six distinctive Aureon artists. Discover your next favourite sound. Premium members can enjoy the full catalogue and exclusive releases.</p>
      </div>
      <div className={styles.actions}>
        <Link href="/membership" className={styles.primary}>Explore Premium membership <span aria-hidden="true">→</span></Link>
        <Link href="/music" className={styles.secondary}>Explore music</Link>
      </div>
    </section>
  );
}
