import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Aureon Music Group home">
      <span className="logo-mark">A</span>
      <span className="logo-text">
        <strong>AUREON</strong>
        <small>MUSIC GROUP</small>
      </span>
    </Link>
  );
}
