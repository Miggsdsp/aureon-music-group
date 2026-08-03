'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Headphones, Instagram, Mail, Music2, Radio, Youtube } from 'lucide-react';
import { usePublishedDocument } from '@/lib/usePublishedDocument';
import { usePublishedCollection, type PublicRecord } from '@/lib/use-published-collection';
import './footer-legal.css';

type SongRecord = PublicRecord & { title?:string; slug?:string; artistName?:string; artist?:string; coverImageUrl?:string; imageUrl?:string; releaseDate?:string; createdAt?:unknown; featured?:boolean };
type LegalRecord = { id:string; title?:string; slug?:string; order?:number };

const defaults = {
  missionTitle:'Our Mission', missionText:'Elevating music. Empowering artists. Creating legacies that inspire generations.', missionHref:'/about',
  latestTitle:'Latest Release', journeyTitle:'Join The Journey', journeyText:'Be the first to hear about new music, artists and exclusive content.', journeyHref:'/contact',
  followTitle:'Follow Us', spotifyUrl:'#', youtubeUrl:'#', instagramUrl:'#', tiktokUrl:'#', appleMusicUrl:'#',
  copyright:'© 2026 Aureon Music Group. All rights reserved.'
};

export function Footer() {
  const { data } = usePublishedDocument<any>('sitePages','footer',defaults);
  const { items:songs } = usePublishedCollection<SongRecord>('songs',[]);
  const [legalDocuments, setLegalDocuments] = useState<LegalRecord[]>([]);
  const value = { ...defaults, ...(data || {}) };

  useEffect(() => {
    let active = true;
    fetch('/api/legal', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(payload => { if (active) setLegalDocuments(Array.isArray(payload.documents) ? payload.documents : []); })
      .catch(() => { if (active) setLegalDocuments([]); });
    return () => { active = false; };
  }, []);

  const latest = [...songs].sort((a,b)=>{
    const featured = Number(Boolean(b.featured))-Number(Boolean(a.featured));
    if(featured) return featured;
    return String(b.releaseDate||'').localeCompare(String(a.releaseDate||''));
  })[0];
  const legalLinks = [...legalDocuments].sort((a,b)=>Number(a.order??999)-Number(b.order??999)||String(a.title).localeCompare(String(b.title)));
  const latestImage = latest?.coverImageUrl || latest?.imageUrl || '/images/branding/Aureon_Header_Logo.png';
  const latestArtist = latest?.artistName || latest?.artist || 'Aureon Music Group';

  return (
    <footer className="aureon-footer">
      <div className="aureon-footer-grid">
        <section className="aureon-footer-panel"><div className="aureon-footer-icon"><Radio size={21}/></div><div><p className="aureon-footer-kicker">{value.missionTitle}</p><p>{value.missionText}</p><Link href={value.missionHref}>Learn more →</Link></div></section>
        <section className="aureon-footer-panel aureon-release-panel"><div className="aureon-footer-icon"><Music2 size={21}/></div><div><p className="aureon-footer-kicker">{value.latestTitle}</p>{latest ? <div className="aureon-release-content"><Image src={latestImage} alt={latest.title || 'Latest release'} width={86} height={86} unoptimized/><div><strong>{latestArtist}</strong><span>{latest.title}</span><Link href={latest.slug ? `/music/${latest.slug}` : '/music'}>Listen now →</Link></div></div> : <p>No published release yet.</p>}</div></section>
        <section className="aureon-footer-panel"><div className="aureon-footer-icon"><Mail size={21}/></div><div><p className="aureon-footer-kicker">{value.journeyTitle}</p><p>{value.journeyText}</p><Link href={value.journeyHref}>Sign up →</Link></div></section>
        <section className="aureon-footer-panel"><div className="aureon-footer-icon"><Headphones size={21}/></div><div><p className="aureon-footer-kicker">{value.followTitle}</p><div className="aureon-social-links" aria-label="Aureon social media"><a href={value.spotifyUrl} aria-label="Spotify">Spotify</a><a href={value.youtubeUrl} aria-label="YouTube"><Youtube size={18}/></a><a href={value.instagramUrl} aria-label="Instagram"><Instagram size={18}/></a><a href={value.tiktokUrl} aria-label="TikTok">TikTok</a><a href={value.appleMusicUrl} aria-label="Apple Music">Apple</a></div></div></section>
      </div>
      <div className="aureon-footer-legal"><p className="aureon-footer-kicker"><Link href="/legal">Legal Centre</Link></p>{legalLinks.length > 0 && <nav aria-label="Legal documents">{legalLinks.map(item=><Link key={item.id} href={`/legal/${item.slug||item.id}`}>{item.title||'Legal document'}</Link>)}</nav>}</div>
      <div className="aureon-footer-bottom"><p>{value.copyright}</p><nav aria-label="Footer links"><Link href="/artists">Artists</Link><Link href="/music">Music</Link><Link href="/videos">Videos</Link><Link href="/legal">Legal Centre</Link><Link href="/contact">Contact</Link></nav></div>
    </footer>
  );
}
