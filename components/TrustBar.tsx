'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Globe2, Headphones, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import styles from './TrustBar.module.css';

const items = [
  { label: 'Secure payments', icon: LockKeyhole },
  { label: 'Official Aureon platform', icon: BadgeCheck },
  { label: 'High-quality audio', icon: Headphones },
  { label: 'Global access', icon: Globe2 },
  { label: 'Privacy first', icon: ShieldCheck },
  { label: 'Creator licensing available', icon: Sparkles },
];

export function TrustBar() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setActive(value => (value + 1) % items.length), 4200);
    return () => window.clearInterval(timer);
  }, []);
  const ItemIcon = items[active].icon;
  return <div className={styles.bar} aria-label="Aureon trust and service assurances">
    <div className={styles.desktop}>{items.map(({ label, icon: Icon }) => <span key={label}><Icon size={14}/>{label}</span>)}</div>
    <div className={styles.mobile} aria-live="polite"><ItemIcon size={14}/><span>{items[active].label}</span></div>
  </div>;
}
