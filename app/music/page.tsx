import { PageShell } from '@/components/PageShell';
import { Play } from 'lucide-react';

export default function MusicPage() {
  return (
    <PageShell title="Music" kicker="Catalogue">
      <div className="release-card">
        <img src="/images/solara-alive.jpg" alt="Solara Alive cover" />
        <div><p className="eyebrow">Latest Release</p><h2>Solara — Alive</h2><p>Preview player and streaming links will be connected as releases go live.</p><button className="primary-button"><Play size={16}/> Preview</button></div>
      </div>
    </PageShell>
  );
}
