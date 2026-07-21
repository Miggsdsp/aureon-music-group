'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Briefcase, Search, UserRound, Volume2 } from 'lucide-react';
import { Logo } from './Logo';
import { useSiteFeatures } from '@/lib/useSiteFeatures';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { firebaseAuth } from '@/lib/firebase-client';

type NavigationLink = [label: string, href: string];

const defaults = { homeLabel:'Home',artistsLabel:'Artists',musicLabel:'Music',membershipLabel:'Membership',videosLabel:'Videos',newsLabel:'News',merchLabel:'Merch',aboutLabel:'About',contactLabel:'Contact',listenLabel:'Subscribe',accountLabel:'Member account',homeHref:'/',artistsHref:'/artists',musicHref:'/music',membershipHref:'/membership',videosHref:'/videos',newsHref:'/news',merchHref:'/merchandise',aboutHref:'/about',contactHref:'/contact',accountHref:'/account' };

function isActive(pathname:string,href:string){if(href==='/')return pathname==='/';return pathname===href||pathname.startsWith(`${href}/`)}

export function Header(){
  const pathname=usePathname();
  const {features}=useSiteFeatures();
  const {data}=usePublishedDocument<any>('sitePages','header',defaults);
  const value={...defaults,...(data||{})};
  const [signedIn,setSignedIn]=useState(Boolean(firebaseAuth.currentUser));
  useEffect(()=>onAuthStateChanged(firebaseAuth,user=>setSignedIn(Boolean(user))),[]);
  const baseLinks:NavigationLink[]=[[value.homeLabel,value.homeHref],[value.artistsLabel,value.artistsHref],[value.musicLabel,value.musicHref],[value.membershipLabel,value.membershipHref],[value.videosLabel,value.videosHref],[value.newsLabel,value.newsHref],[value.aboutLabel,value.aboutHref],[value.contactLabel,value.contactHref]];
  const links:NavigationLink[]=features.merchandiseEnabled?[...baseLinks.slice(0,6),[value.merchLabel,value.merchHref],...baseLinks.slice(6)]:baseLinks;
  return <header className="site-header premium-label-header"><Logo/><nav className="desktop-nav" aria-label="Main navigation">{links.map(([label,href])=><Link key={href} href={href} className={isActive(pathname,href)?'active':''}>{label}</Link>)}</nav><div className="header-actions"><Link href={value.musicHref} className="header-icon" aria-label="Search music"><Search size={20}/></Link>{features.merchandiseEnabled&&<Link href={value.merchHref} className="header-icon" aria-label="Store"><Briefcase size={20}/></Link>}<Link href={value.accountHref} className="member-login-link" aria-label={signedIn?'Open member dashboard':'Subscriber login'}><UserRound size={18}/><span>{signedIn?'My dashboard':'Login'}</span></Link><Link href={value.membershipHref} className="join-button listen-button">{value.listenLabel}<Volume2 size={16}/></Link></div></header>;
}
