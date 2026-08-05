import { BadgeCheck, Clapperboard, Disc3, Radio } from 'lucide-react';
import styles from './ProductTrustBadge.module.css';

type Kind = 'artist' | 'album' | 'video' | 'audio';

const config = {
  artist: { label: 'Official Aureon Artist', Icon: BadgeCheck },
  album: { label: 'Official Aureon Album', Icon: Disc3 },
  video: { label: 'Official Aureon Video', Icon: Clapperboard },
  audio: { label: 'HD Audio', Icon: Radio },
} as const;

export function ProductTrustBadge({ kind, compact = false }: { kind: Kind; compact?: boolean }) {
  const { label, Icon } = config[kind];
  return <span className={`${styles.badge} ${compact ? styles.compact : ''}`} aria-label={label}><Icon size={compact ? 12 : 14}/>{label}</span>;
}
