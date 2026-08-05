'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { AccountSecurityPanel, CreatorLicensingTrustPanel, PrivacyFirstPanel } from './CreatorAccountTrust';
import styles from './AccountTrustMount.module.css';

type MemberState = { stripeCustomerId?: string; plan?: string; subscriptionActive?: boolean };

export function AccountTrustMount() {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [member, setMember] = useState<MemberState | null>(null);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);
  useEffect(() => {
    if (!user) { setMember(null); return; }
    return onSnapshot(doc(firestore, 'members', user.uid), snapshot => {
      setMember(snapshot.exists() ? snapshot.data() as MemberState : null);
    }, () => setMember(null));
  }, [user]);

  if (!user) return <div className={styles.wrap}><PrivacyFirstPanel /></div>;

  return (
    <section className={styles.wrap} aria-label="Account trust and security">
      <AccountSecurityPanel emailVerified={user.emailVerified} billingProtected={Boolean(member?.stripeCustomerId)} />
      <CreatorLicensingTrustPanel compact />
    </section>
  );
}
