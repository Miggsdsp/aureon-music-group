import { PageShell, ArtistGrid, ReleaseCard } from '../components';

export default function Page(){
  return <PageShell title="Artists" kicker="Aureon Music Group">
    <section className="content">
      <ArtistGrid/>
    </section>
  </PageShell>
}
