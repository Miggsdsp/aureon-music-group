'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Briefcase, Search, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import { TrustBar } from './TrustBar';
import { useSiteFeatures } from '@/lib/useSiteFeatures';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { firebaseAuth } from '@/lib/firebase-client';

type NavigationLink = [label: string, href: string];

const defaults = {
  homeLabel: 'Home',
  artistsLabel: 'Artists',
  musicLabel: 'Music',
  videosLabel: 'Videos',
  merchLabel: 'Merch',
  membershipLabel: 'Membership',
  newsLabel: 'News',
  aboutLabel: 'About',
  contactLabel: 'Contact',
  accountLabel: 'Member account',
  homeHref: '/',
  artistsHref: '/artists',
  musicHref: '/music',
  videosHref: '/videos',
  merchHref: '/merchandise',
  membershipHref: '/membership',
  newsHref: '/news',
  aboutHref: '/about',
  contactHref: '/contact',
  accountHref: '/account'
};

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const { features } = useSiteFeatures();
  const { data } = usePublishedDocument<any>('sitePages', 'header', defaults);
  const value = { ...defaults, ...(data || {}) };
  const [signedIn, setSignedIn] = useState(Boolean(firebaseAuth.currentUser));

  useEffect(() => onAuthStateChanged(firebaseAuth, user => setSignedIn(Boolean(user))), []);

  const links: NavigationLink[] = [
    [value.homeLabel, value.homeHref],
    [value.artistsLabel, value.artistsHref],
    [value.musicLabel, value.musicHref],
    [value.videosLabel, value.videosHref],
    ...(features.merchandiseEnabled ? [[value.merchLabel, value.merchHref] as NavigationLink] : []),
    [value.membershipLabel, value.membershipHref],
    [value.newsLabel, value.newsHref],
    [value.aboutLabel, value.aboutHref],
    [value.contactLabel, value.contactHref]
  ];

  return <>
    <header className="site-header premium-label-header">
      <Logo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className={isActive(pathname, href) ? 'active' : ''}>{label}</Link>
        ))}
      </nav>
      <div className="header-actions">
        <Link href={value.musicHref} className="header-icon" aria-label="Search music"><Search size={20} /></Link>
        {features.merchandiseEnabled && <Link href={value.merchHref} className="header-icon" aria-label="Store"><Briefcase size={20} /></Link>}
        <Link href={value.accountHref} className="member-login-link" aria-label={signedIn ? 'Open member account' : 'Login'}><UserRound size={18} /><span>{signedIn ? 'My Account' : 'Login'}</span></Link>
      </div>
    </header>
    <TrustBar />
  </>;
}
