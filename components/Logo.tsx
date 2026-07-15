'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export function Logo() {
  const { data } = usePublishedDocument<any>('sitePages', 'header', {
    logoUrl: '/images/branding/Aureon_Header_Logo.png',
    logoAlt: 'Aureon Music Group'
  });
  const src = data?.logoUrl || '/images/branding/Aureon_Header_Logo.png';
  const alt = data?.logoAlt || 'Aureon Music Group';

  return (
    <Link href="/" className="logo aureon-image-logo" aria-label={`${alt} home`}>
      <Image src={src} alt={alt} width={520} height={180} priority className="aureon-logo-img" unoptimized />
    </Link>
  );
}
