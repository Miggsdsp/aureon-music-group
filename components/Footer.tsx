import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Logo />
        <p>Creating Tomorrow&apos;s Classics.</p>
      </div>
      <div className="footer-links">
        <Link href="/artists">Artists</Link>
        <Link href="/music">Music</Link>
        <Link href="/licensing">Licensing</Link>
        <Link href="/contact">Contact</Link>
      </div>
      <p className="copyright">© 2026 Aureon Music Group. All rights reserved.</p>
    </footer>
  );
}
