import { PageShell } from '@/components/PageShell';
import Link from 'next/link';
import { creatorLicensingPages } from '@/lib/creator-licensing-pages';

export default function LicensingPage() {
  return (
    <PageShell title="Licensing" kicker="Sync & business">
      <h2>License Aureon music for creators, podcasts, social media and commercial projects.</h2>
      <p>Aureon licensing is governed by the published Master Music Licensing Agreement, Creator Licence Agreement and Commercial Licensing Agreement. Creator use requires an active Aureon Creator subscription and must stay within the applicable licence limits.</p>
      <div className="album-grid">
        {creatorLicensingPages.map(page => (
          <Link className="album-card" href={page.path} key={page.path}>
            <div className="album-card-copy">
              <p>{page.kicker}</p>
              <h3>{page.title}</h3>
              <strong>{page.audience}</strong>
              <span>{page.description}</span>
              <em>Open guide →</em>
            </div>
          </Link>
        ))}
      </div>
      <p>For wider advertising, broadcast, public performance, TV, radio, venue or enterprise use, request written confirmation from Aureon before publishing the project.</p>
      <p><Link className="ghost-button" href="/legal/licensing-agreement">Read licensing terms →</Link></p>
    </PageShell>
  );
}
