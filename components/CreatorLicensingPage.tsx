import Link from 'next/link';
import { CheckCircle2, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import { ServerFooter } from '@/components/ServerFooter';
import { LatestPlayButton } from '@/components/LatestPlayButton';
import { AnalyticsView } from '@/components/AnalyticsView';
import { CreatorLicensingCta } from '@/components/CreatorLicensingCta';
import { ArtworkImage } from '@/components/ArtworkImage';
import { creatorLicensingPages, type CreatorLicensingPageConfig } from '@/lib/creator-licensing-pages';
import { publicCatalogueRecord } from '@/lib/public-catalogue';
import { getPublishedRecords, breadcrumbSchema, safeJsonLd, SITE_URL } from '@/lib/seo';
import { faqSchema } from '@/lib/schema';
import styles from './CreatorLicensingPage.module.css';

function dateScore(song: Record<string, any>) {
  const value = song.releaseDate || song.publishedAt || song.publishDate || song.createdAt || '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

async function getPreviewSongs() {
  const songs = await getPublishedRecords('songs');
  const eligible = songs
    .map(song => publicCatalogueRecord(song, true))
    .filter(song => song.previewUrl && song.slug && song.title)
    .sort((a, b) => dateScore(b) - dateScore(a) || String(a.title).localeCompare(String(b.title)));
  const selected: Record<string, any>[] = [];
  const selectedArtists = new Set<string>();
  for (const song of eligible) {
    const artistKey = String(song.artistSlug || song.artistId || song.artistName || song.artist || '').trim().toLowerCase();
    if (artistKey && selectedArtists.has(artistKey)) continue;
    selected.push(song);
    if (artistKey) selectedArtists.add(artistKey);
    if (selected.length === 3) return selected;
  }
  for (const song of eligible) {
    if (selected.some(item => item.id === song.id)) continue;
    selected.push(song);
    if (selected.length === 3) break;
  }
  return selected;
}

export async function CreatorLicensingPage({ page }: { page: CreatorLicensingPageConfig }) {
  const previewSongs = await getPreviewSongs();
  const related = creatorLicensingPages.filter(item => item.slug !== page.slug);
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Licensing', path: '/licensing' },
    { name: page.title, path: page.path },
  ]);
  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}${page.path}#webpage`,
    name: page.title,
    url: `${SITE_URL}${page.path}`,
    description: page.description,
    isPartOf: { '@type': 'WebSite', name: 'Aureon Music Group', url: SITE_URL },
    audience: { '@type': 'Audience', audienceType: page.audience },
  };
  const faq = faqSchema(page.faqs);

  return (
    <main className="page-shell creator-licensing-page">
      <AnalyticsView event={{
        eventType: 'creator_landing_view',
        entityType: 'creator_licensing_page',
        entityId: page.slug,
        slug: page.slug,
        title: page.title,
        metadata: { useCase: page.useCase },
      }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([webPage, breadcrumbs, faq].filter(Boolean)) }} />
      <Header />

      <section className="inner-hero">
        <p className="eyebrow">{page.kicker}</p>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
        <div className={styles.heroActions}>
          <CreatorLicensingCta href="/membership" label={page.primaryCta} pageSlug={page.slug} cta="membership" />
          <CreatorLicensingCta href="#creator-preview-music" label={page.secondaryCta} pageSlug={page.slug} cta="preview_music" variant="ghost" />
        </div>
      </section>

      <section className="content-panel">
        <p className="eyebrow">Licence-first music discovery</p>
        <h2>Clear music access for {page.useCase}</h2>
        <p>{page.intro}</p>
        <div className={styles.grid}>
          {page.supportedUses.map(item => (
            <article className={styles.card} key={item}>
              <CheckCircle2 size={20} />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <p className="eyebrow">Important licence boundaries</p>
        <h2>What the current Aureon terms require</h2>
        <div className={styles.grid}>
          {page.limits.map(item => (
            <article className={styles.card} key={item}>
              <ShieldCheck size={20} />
              <p>{item}</p>
            </article>
          ))}
        </div>
        <p>
          Read the current <Link href="/legal/licensing-agreement">Master Music Licensing Agreement</Link>,{' '}
          <Link href="/legal/creator-license">Creator Licence Agreement</Link> and{' '}
          <Link href="/legal/commercial-licensing">Commercial Licensing Agreement</Link> before using music in a project.
        </p>
      </section>

      <section className="content-panel" id="creator-preview-music">
        <p className="eyebrow">Preview the catalogue</p>
        <h2>Hear Aureon music before you choose a plan</h2>
        <p>These are public preview clips only. Protected masters, subscriber streams and licensed downloads remain private until the correct account, subscription and licence flow applies.</p>
        <div className={styles.previewGrid}>
          {previewSongs.map(song => {
            const title = String(song.title || song.name || 'Aureon song');
            const artist = String(song.artistName || song.artist || 'Aureon Music Group');
            return (
              <article className={styles.previewCard} key={song.id}>
                {song.coverImageUrl && <ArtworkImage src={song.coverImageUrl} alt={`${title} artwork`} width={640} height={640} />}
                <p className="eyebrow">{song.genre || 'Aureon preview'}</p>
                <h3><Link href={`/songs/${song.slug}`}>{title}</Link></h3>
                <p>{artist}</p>
                <LatestPlayButton
                  title={title}
                  src={song.previewUrl}
                  artwork={song.coverImageUrl}
                  showPurchase={false}
                  buttonLabel="Preview track"
                  analytics={{
                    id: song.id,
                    slug: song.slug,
                    genre: song.genre,
                    artistId: song.artistId,
                    artistSlug: song.artistSlug,
                    artistName: artist,
                    albumId: song.albumId,
                    albumSlug: song.albumSlug,
                    albumTitle: song.albumTitle,
                  }}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className="content-panel">
        <p className="eyebrow">Creator licensing FAQ</p>
        <h2>Questions creators ask before using music</h2>
        <div className={styles.faqGrid}>
          {page.faqs.map(item => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-panel">
        <p className="eyebrow">Related creator pages</p>
        <h2>Find the right licensing path</h2>
        <div className={styles.grid}>
          {related.map(item => (
            <article className={styles.card} key={item.path}>
              <Sparkles size={20} />
              <h3><Link href={item.path}>{item.title}</Link></h3>
              <p>{item.description}</p>
            </article>
          ))}
          <article className={styles.card}>
            <FileText size={20} />
            <h3><Link href="/contact">Need written confirmation?</Link></h3>
            <p>For uses outside the Creator Licence scope, contact Aureon before publishing or distributing the project.</p>
          </article>
        </div>
      </section>

      <ServerFooter />
    </main>
  );
}
