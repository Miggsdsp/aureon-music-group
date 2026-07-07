import { PageShell } from '@/components/PageShell';

export default function VideosPage() {
  return (
    <PageShell title="Videos" kicker="Visual world">
      <div className="video-grid">
        {['Official Visualizers','Lyric Videos','Studio Sessions','Behind The Song'].map((item)=><article key={item}><h3>{item}</h3><p>Ready for YouTube embeds and cinematic release assets.</p></article>)}
      </div>
    </PageShell>
  );
}
