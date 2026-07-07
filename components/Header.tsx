import Link from 'next/link';
import { Logo } from './Logo';

const links = [
  ['Artists', '/artists'],
  ['Music', '/music'],
  ['Videos', '/videos'],
  ['Licensing', '/licensing'],
  ['Merchandise', '/merchandise'],
  ['Contact', '/contact']
];

export function Header() {
  return (
    <header className="site-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href}>{label}</Link>
        ))}
      </nav>
      <Link href="/contact" className="join-button">Join the Journey</Link>
    </header>
  );
}
