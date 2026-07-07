import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Aureon Music Group home">
      <span className="logo-mark" aria-hidden="true">
        <span>A</span>
      </span>
      <span className="logo-text">
        <strong>AUREON</strong>
        <small>MUSIC GROUP</small>
      </span>
    </Link>
  );
}
