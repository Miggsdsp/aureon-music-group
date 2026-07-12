'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Search, Volume2 } from 'lucide-react';
import { Logo } from './Logo';
import { useSiteFeatures } from '@/lib/useSiteFeatures';

const baseLinks = [
  ['Home', '/'],
  ['Artists', '/artists'],
  ['Music', '/music'],
  ['Videos', '/videos'],
  ['News', '/news'],
  ['About', '/about'],
  ['Contact', '/contact']
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const { features } = useSiteFeatures();
  const links = features.merchandiseEnabled
    ? [...baseLinks.slice(0, 5), ['Merch', '/merchandise'], ...baseLinks.slice(5)]
    : baseLinks;

  return (
    <header className="site-header premium-label-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className={isActive(pathname, href) ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link href="/music" className="header-icon" aria-label="Search music"><Search size={20} /></Link>
        {features.merchandiseEnabled && <Link href="/merchandise" className="header-icon" aria-label="Store"><Briefcase size={20} /></Link>}
        <Link href="/music" className="join-button listen-button">Listen Now <Volume2 size={16} /></Link>
      </div>
    </header>
  );
}
