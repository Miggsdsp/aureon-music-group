import Image from 'next/image';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="logo aureon-image-logo" aria-label="Aureon Music Group home">
      <Image
        src="/images/branding/aureon-logo.png"
        alt="Aureon Music Group"
        width={520}
        height={180}
        priority
        className="aureon-logo-img"
      />
    </Link>
  );
}
