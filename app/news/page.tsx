import { PageShell } from '@/components/PageShell';

const posts = [
  ['Aureon Music Group launches its digital platform', 'The official home for Aureon artists, releases, licensing and future fan experiences is now live.'],
  ['Phase 1 website foundation begins', 'The label platform now has a cinematic homepage, working navigation and a scalable Next.js structure.'],
  ['First release pipeline preparing', 'Solara, Ryder Blackwood, Ganja Boy, Ash Cadwell and Zenara will form the initial launch roster.']
];

export default function NewsPage() {
  return (
    <PageShell title="News" kicker="Aureon Updates">
      <div className="video-grid">
        {posts.map(([title, copy]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
