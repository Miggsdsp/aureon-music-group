import { PageShell } from '@/components/PageShell';

const artists = [
  ['Solara', 'Deep House', 'Melodic, emotional and built around unforgettable piano-led electronic moments.'],
  ['Ryder Blackwood', 'Western Pop / Country', 'A deep male voice telling ranch-life stories with crossover country hooks.'],
  ['Ganja Boy', 'Reggae', 'Soulful reggae about calm, release, herb culture and peaceful living.'],
  ['Ash Cadwell', 'Blues', 'Vintage blues with whiskey warmth, late-night guitar and lived-in vocals.'],
  ['Zenara', 'Afro House', 'Premium Afro House energy made for sunset clubs, festivals and global playlists.']
];

export default function ArtistsPage() {
  return (
    <PageShell title="Artists" kicker="Aureon roster">
      <div className="artist-grid page-grid">
        {artists.map(([name, genre, desc]) => (
          <article className="artist-card tall" key={name}>
            <p>{genre}</p><h3>{name}</h3><span>{desc}</span>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
