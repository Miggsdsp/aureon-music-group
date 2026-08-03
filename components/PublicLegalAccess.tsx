'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scale } from 'lucide-react';

export function PublicLegalAccess() {
  const pathname = usePathname();
  if (!pathname || pathname.startsWith('/admin') || pathname === '/legal') return null;

  return (
    <Link className="public-legal-access" href="/legal" aria-label="Open the Aureon Legal Centre">
      <Scale size={18} aria-hidden="true" />
      <span>Legal Centre</span>
    </Link>
  );
}
