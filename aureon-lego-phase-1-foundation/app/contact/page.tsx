import { PageShell, ArtistGrid, ReleaseCard } from '../components';

export default function Page(){
  return <PageShell title="Contact" kicker="Aureon Music Group">
    <section className="content">
      <div className="cards"><div className="card"><h3>Premium Label Standard</h3><p>This page is ready for Phase 2 content and connects cleanly to the full Aureon platform.</p></div><div className="card"><h3>Commercial Focus</h3><p>Built to move visitors toward listening, buying, licensing, joining or contacting Aureon.</p></div><div className="card"><h3>Next Lego Block</h3><p>Future phases can replace this content without breaking the foundation.</p></div></div>
    </section>
  </PageShell>
}
