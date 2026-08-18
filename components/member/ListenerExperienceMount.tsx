'use client';

import { usePathname } from 'next/navigation';
import ListenerExperience from './ListenerExperience';

export default function ListenerExperienceMount() {
  const pathname = usePathname();
  if (pathname !== '/library') return null;
  return <div className="listener-experience-mount"><ListenerExperience /></div>;
}
