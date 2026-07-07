import { PageShell, ArtistGrid, ReleaseCard } from '../components';

export default function Page(){
  return <PageShell title="Music Catalogue" kicker="Aureon Music Group">
    <section className="content">
      <ReleaseCard/><div className="cards" style={{marginTop:30}}><div className="card"><h3>Solara — Alive</h3><p>Deep House</p></div><div className="card"><h3>Ryder Blackwood — Under The Texan Sky</h3><p>Western Pop / Country</p></div><div className="card"><h3>Ganja Boy — Love For The Herb</h3><p>Reggae</p></div></div>
    </section>
  </PageShell>
}
