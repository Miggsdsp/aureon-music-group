'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// The listener library is substantial and was previously bundled into the global
// layout even on pages that never render it. Load it only when /library is opened;
// UI and behaviour on the library page remain unchanged.
const ListenerExperience = dynamic(() => import('./ListenerExperience'), {
  ssr: false,
  loading: () => null,
});

export default function ListenerExperienceMount() {
  const pathname = usePathname();
  if (pathname !== '/library') return null;
  return <div className="listener-experience-mount"><ListenerExperience /></div>;
}
