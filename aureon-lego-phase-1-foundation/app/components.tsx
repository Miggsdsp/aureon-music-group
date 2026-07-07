import Link from 'next/link';
import { artists, socials } from './data';

export function Logo() {
  return <Link className="logo" href="/"><span className="mark">✦</span><span>AUREON</span><small>MUSIC GROUP</small></Link>;
}

export function Nav() {
  return <header className="nav"><Logo/><nav><Link href="/about">About</Link><Link href="/artists">Artists</Link><Link href="/music">Music</Link><Link href="/videos">Videos</Link><Link href="/news">News</Link><Link href="/merchandise">Merchandise</Link><Link href="/licensing">Licensing</Link><Link href="/contact" className="navCta">Join The Journey</Link></nav></header>;
}

export function HeroBackground(){
  return <div className="heroBg"><video className="heroVideo" autoPlay muted loop playsInline poster="/images/aureon-studio-hero.png"><source src="/videos/studio-loop.mp4" type="video/mp4"/></video><div className="screenPulse"><i/><i/><i/><i/></div><div className="grain"/><div className="shade"/></div>;
}

export function Footer(){return <footer className="footer"><Logo/><div className="socials">{socials.map(s=><span key={s}>{s}</span>)}</div><p>© 2026 Aureon Music Group. Creating Tomorrow&apos;s Classics.</p></footer>}

export function PageShell({title, kicker, children}:{title:string;kicker:string;children:React.ReactNode}){return <><Nav/><main className="page"><section className="pageHero"><p className="kicker">{kicker}</p><h1>{title}</h1></section>{children}</main><Footer/></>}

export function ArtistGrid(){return <div className="artistGrid">{artists.map((a,i)=><Link className="artistCard" href={`/artists#${a.slug}`} key={a.slug}><span>0{i+1}</span><h3>{a.name}</h3><p>{a.genre}</p><em>{a.mood}</em></Link>)}</div>}

export function ReleaseCard(){return <div className="releaseCard"><div className="cover"><span>▶</span></div><div><p className="kicker">Latest Release</p><h3>Solara — Alive</h3><p>Melodic deep house built around a memorable piano motif and warm emotional progression.</p><Link href="/music">Listen Now →</Link></div></div>}
