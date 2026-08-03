'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NewReleases } from '@/components/discovery/NewReleases';

const titleCase=(value:string)=>value.split('-').map(part=>part?part[0].toUpperCase()+part.slice(1):'').join(' ');

export default function GenrePage(){
  const{slug}=useParams<{slug:string}>();
  const genre=slug==='all'?'':titleCase(decodeURIComponent(slug));
  return <main className="page-shell">
    <Header/>
    <section className="content-panel" style={{paddingTop:'140px',paddingBottom:'44px'}}>
      <p className="eyebrow">Aureon Discovery</p>
      <h1>{genre?`${genre} New Releases`:'All New Releases'}</h1>
      <p>Explore Aureon singles, albums, EPs, live releases and remasters, ordered by release date.</p>
      <Link className="ghost-button" href="/discover">← Back to Discover</Link>
    </section>
    <NewReleases genre={genre} showFilters limit={48}/>
    <Footer/>
  </main>;
}
