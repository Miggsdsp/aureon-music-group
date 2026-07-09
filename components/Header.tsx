import Link from 'next/link';
import { Briefcase, Search, Volume2 } from 'lucide-react';
import { Logo } from './Logo';

const links = [
  ['Home', '/'],
  ['Artists', '/artists'],
  ['Music', '/music'],
  ['Videos', '/videos'],
  ['News', '/news'],
  ['Merch', '/merchandise'],
  ['About', '/about'],
  ['Contact', '/contact']
];

export function Header() {
  return (
    <header className="site-header premium-label-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className={href === '/artists' ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link href="/music" className="header-icon" aria-label="Search music"><Search size={20} /></Link>
        <Link href="/merchandise" className="header-icon" aria-label="Store"><Briefcase size={20} /></Link>
        <Link href="/music" className="join-button listen-button">Listen Now <Volume2 size={16} /></Link>
      </div>
    </header>
  );
}
