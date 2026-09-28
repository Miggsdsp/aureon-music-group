import { ServerPageShell } from '@/components/ServerPageShell';
import Link from 'next/link';
import { creatorLicensingPages } from '@/lib/creator-licensing-pages';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Music Licensing Hub | Creator & Commercial Licensing | Aureon Music Group',
  description: 'Explore Aureon Music Group licensing routes for creators, YouTube, podcasts, social media, commercial videos and specialist business use.',
  path: '/licensing',
});

export default function LicensingPage() {
  return (
    <ServerPageShell title="Licensing" kicker="Sync & business">
      <h2>Choose the right Aureon licensing route for your project.</h2>
      <p>Aureon offers two clear public routes: Creator Licensing for eligible creator-led online use, and Commercial Licensing for wider business, advertising, broadcast, venue, public performance or specialist project requirements.</p>
      <p>All use remains governed by the published Master Music Licensing Agreement, Creator Licence Agreement and Commercial Licensing Agreement. Creator use requires an active Aureon Creator subscription and must stay within the applicable licence limits.</p>
      <div className="album-grid">
        <Link className="album-card" href="/music-for-content-creators">
          <div className="album-card-copy">
            <p>Creator Licensing</p>
            <h3>For creators, YouTube, podcasts and social media</h3>
            <strong>Start with the Creator licensing guides.</strong>
            <span>Review music access for online creator projects, preview the public catalogue and compare Creator membership before publishing.</span>
            <em>Open Creator licensing →</em>
          </div>
        </Link>
        <Link className="album-card" href="/legal/commercial-licensing">
          <div className="album-card-copy">
            <p>Commercial Licensing</p>
            <h3>For brands, agencies and specialist projects</h3>
            <strong>Request written confirmation for broader use.</strong>
            <span>Advertising, broadcast, public performance, TV, radio, venue, enterprise or wider commercial uses may require a separate commercial licence.</span>
            <em>Review commercial terms →</em>
          </div>
        </Link>
      </div>
      <h2>Creator licensing guides</h2>
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
      <p>For wider advertising, broadcast, public performance, TV, radio, venue, enterprise or other use outside the Creator Licence scope, contact Aureon and request written confirmation before publishing the project.</p>
      <p><Link className="ghost-button" href="/contact">Contact Aureon about licensing →</Link> <Link className="ghost-button" href="/legal/licensing-agreement">Read licensing terms →</Link></p>
    </ServerPageShell>
  );
}
