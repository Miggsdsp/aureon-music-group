'use client';

import { usePathname } from 'next/navigation';
import ListenerExperience from './ListenerExperience';

export default function ListenerExperienceMount() {
  const pathname = usePathname();
  if (pathname !== '/library') return null;
  return <div style={{ maxWidth: '1600px', margin: '-110px auto 130px', padding: '0 5vw', position: 'relative', zIndex: 3 }}><ListenerExperience /></div>;
}
