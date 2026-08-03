'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scale } from 'lucide-react';
import './public-legal-access.css';

export function PublicLegalAccess() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  if (pathname === '/legal') return null;

  return (
    <Link className="public-legal-access" href="/legal" aria-label="Open the Aureon Legal Centre">
      <Scale size={18} aria-hidden="true" />
      <span>Legal Centre</span>
    </Link>
  );
}
