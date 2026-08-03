import type { Metadata } from 'next';
import MusicPlayerProvider from '@/components/music/MusicPlayerProvider';
import ListenerExperienceMount from '@/components/member/ListenerExperienceMount';
import RoutePrefetcher from '@/components/RoutePrefetcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import GrowthAnalyticsBridge from '@/components/GrowthAnalyticsBridge';
import { DEFAULT_IMAGE, SITE_NAME, SITE_URL, safeJsonLd } from '@/lib/seo';
import './globals.css';
import './finish.css';
import './sprint2.css';
import './artists-header-fix.css';
import './homepage-fit-fix.css';
import './artist-profiles.css';
import './music-catalogue.css';
import './video-catalogue.css';
import './news.css';
import './merch-store.css';
import './about.css';
import './about-cleanup.css';
import './contact.css';
import './digital-music-store.css';
import './footer.css';
import './phase1-polish.css';
import './admin.css';
import './admin-phase2-final.css';
import './admin-dashboard-polish.css';

const title = "Aureon Music Group | Creating Tomorrow's Classics";
const description = 'A premium independent music company for original artists, streaming, music discovery, memberships and commercial licensing.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: `%s | ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  alternates: { canonical: SITE_URL },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  openGraph: { title, description, url: SITE_URL, siteName: SITE_NAME, images: [{ url: DEFAULT_IMAGE, width: 1200, height: 630, alt: SITE_NAME }], locale: 'en_IE', type: 'website' },
  twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_IMAGE] },
};

const organizationSchema = { '@context': 'https://schema.org', '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}${DEFAULT_IMAGE}`, description };
const websiteSchema = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME, url: SITE_URL, publisher: { '@id': `${SITE_URL}/#organization` }, potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en-IE"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd([organizationSchema, websiteSchema]) }} />
    <MusicPlayerProvider>
      {children}
      <ListenerExperienceMount />
      <RoutePrefetcher />
      <WebVitalsReporter />
      <GrowthAnalyticsBridge />
    </MusicPlayerProvider>
  </body></html>;
}
