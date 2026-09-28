import type { Metadata } from 'next';

export type CreatorLicensingPageConfig = {
  slug: string;
  path: string;
  title: string;
  kicker: string;
  seoTitle: string;
  description: string;
  audience: string;
  useCase: string;
  primaryCta: string;
  secondaryCta: string;
  intro: string;
  supportedUses: string[];
  limits: string[];
  faqs: Array<{ question: string; answer: string }>;
};

const SITE_URL = 'https://www.aureonmusicgroup.com';

const commonLimits = [
  'Creator licensing requires an active Aureon Creator subscription and remains subject to the Creator Licence Agreement and Master Music Licensing Agreement.',
  'Exactly 5 high-quality licensed download actions are available per billing cycle; re-downloads count and unused actions do not roll over.',
  'Aureon grants limited licence rights only. Copyright, master recordings and other intellectual property rights are not transferred.',
  'Uses outside the applicable licence scope require Aureon’s written approval or a separate Commercial Licence.',
];

const commonFaqs = [
  {
    question: 'Do I own the music after subscribing?',
    answer: 'No. Aureon licence terms state that ownership of the music, master recordings and related intellectual property remains with Aureon Music Group or the applicable rights holder. A Creator subscription grants limited use rights within the applicable licence scope.',
  },
  {
    question: 'How many Creator downloads are included?',
    answer: 'The Aureon Creator plan includes exactly 5 high-quality licensed download actions per billing cycle. Every download action counts, including re-downloads, and the allowance resets on the next billing date.',
  },
  {
    question: 'Do Creator licence rights continue after cancellation?',
    answer: 'Creator licence rights require an active Aureon Creator subscription. Aureon’s current licence wording states that rights remain valid only while the associated Creator subscription remains active and the use stays within Aureon Creator licence limits.',
  },
  {
    question: 'Are public performance, TV, radio or broadcast rights automatically included?',
    answer: 'No. The published commercial licensing terms state that public performance and broadcast rights are not automatic unless expressly licensed. Uses such as TV, radio, satellite, public venues and commercial events may require additional approval or a separate commercial licence.',
  },
  {
    question: 'Can Aureon music be used for AI training or dataset creation?',
    answer: 'No blanket AI-training right is granted. Aureon’s licensing terms prohibit AI use involving licensed content unless expressly authorised in writing or permitted under Aureon’s AI Music Policy.',
  },
];

export const creatorLicensingPages: CreatorLicensingPageConfig[] = [
  {
    slug: 'music-for-content-creators',
    path: '/music-for-content-creators',
    title: 'Music for Content Creators',
    kicker: 'Creator licensing',
    seoTitle: 'Music for Content Creators | Aureon Creator Licensing',
    description: 'Discover Aureon music for online content, creator projects, social videos, podcasts and business promotional content within Aureon Creator licence terms.',
    audience: 'Digital creators, online educators, independent publishers and creator-led businesses.',
    useCase: 'content creators',
    primaryCta: 'Explore Creator membership',
    secondaryCta: 'Preview Aureon music',
    intro: 'Aureon Creator is built for creators who need high-quality music access with clear licence boundaries. Use must stay within the published Creator Licence Agreement, Master Music Licensing Agreement and any applicable commercial licence confirmation.',
    supportedUses: [
      'YouTube videos and online creator content where covered by the Creator Licence.',
      'Podcast episodes, livestreams, social media posts and online educational content within licence limits.',
      'Business promotional content where the Creator Licence applies, or where Aureon confirms the relevant commercial licence scope.',
    ],
    limits: commonLimits,
    faqs: [
      {
        question: 'What types of creator content can Aureon music support?',
        answer: 'The published Master Music Licensing Agreement says Creator Licence permitted uses may include YouTube videos, podcasts, livestreams, social media content, online educational content and business promotional content within licence limits.',
      },
      ...commonFaqs,
    ],
  },
  {
    slug: 'music-for-youtube',
    path: '/music-for-youtube',
    title: 'Music for YouTube Videos',
    kicker: 'YouTube creator music',
    seoTitle: 'Music for YouTube Videos | Aureon Creator Licensing',
    description: 'Use Aureon music in YouTube creator videos under the Aureon Creator licence terms, with clear limits, active subscription requirements and licensed downloads.',
    audience: 'YouTubers, video creators and channel owners creating online video content.',
    useCase: 'youtube',
    primaryCta: 'Start Creator access',
    secondaryCta: 'Hear catalogue previews',
    intro: 'For YouTube creators, Aureon’s published licence terms identify YouTube videos as a possible Creator Licence use. The licence is not a transfer of ownership and must remain within the active Creator subscription and applicable licence scope.',
    supportedUses: [
      'YouTube videos where the Creator Licence applies.',
      'Channel content and online video projects that stay inside Aureon’s licence limits.',
      'Creator downloads for editing workflows, subject to the 5-action billing-cycle allowance.',
    ],
    limits: [
      ...commonLimits,
      'Aureon does not promise that every platform claim, monetisation review or third-party rights issue is automatically resolved; creators must keep use within the licence and platform rules.',
    ],
    faqs: [
      {
        question: 'Can I use Aureon music in YouTube videos?',
        answer: 'Aureon’s Master Music Licensing Agreement states that Creator Licence permitted uses may include YouTube videos. The use must remain within the Creator Licence Agreement and requires an active Creator subscription.',
      },
      {
        question: 'Does this guarantee YouTube monetisation or remove every claim?',
        answer: 'No. The licence grants limited rights within Aureon’s scope, but the site should not promise guaranteed monetisation, platform approval or claim-free operation because those outcomes are not stated in the published terms.',
      },
      ...commonFaqs,
    ],
  },
  {
    slug: 'music-for-podcasts',
    path: '/music-for-podcasts',
    title: 'Music for Podcasts',
    kicker: 'Podcast creator music',
    seoTitle: 'Music for Podcasts | Aureon Creator Licensing',
    description: 'Preview Aureon music for podcast intros, segments and creator-led audio projects within Aureon Creator and commercial licensing terms.',
    audience: 'Podcast hosts, independent audio creators and branded podcast producers.',
    useCase: 'podcasts',
    primaryCta: 'Compare Creator plan',
    secondaryCta: 'Preview podcast-friendly music',
    intro: 'Aureon’s Creator Licence terms identify podcasts as a possible authorised creator use. The safest path is to keep every use inside the active Creator licence limits and seek written confirmation for broader commercial, broadcast or advertising use.',
    supportedUses: [
      'Podcast intros, outros and segments where the Creator Licence applies.',
      'Creator-led podcast episodes distributed online within licence limits.',
      'Branded or business podcast use only where the applicable Creator or Commercial Licence covers the project.',
    ],
    limits: [
      ...commonLimits,
      'Broadcast, radio, public performance or large commercial distribution should be treated as commercial licensing unless Aureon confirms otherwise in writing.',
    ],
    faqs: [
      {
        question: 'Can podcasts use Aureon music?',
        answer: 'The Master Music Licensing Agreement states that Creator Licence permitted uses may include podcasts. The use must stay within the Creator Licence Agreement and the subscription must remain active.',
      },
      {
        question: 'Can a business podcast use Aureon music?',
        answer: 'Possibly, but business, advertising, broadcast or larger commercial uses may require a Commercial Licence or written confirmation from Aureon. The page does not claim blanket clearance for every business podcast.',
      },
      ...commonFaqs,
    ],
  },
  {
    slug: 'music-for-social-media',
    path: '/music-for-social-media',
    title: 'Music for Social Media',
    kicker: 'Social creator licensing',
    seoTitle: 'Music for Social Media | Aureon Creator Licensing',
    description: 'Aureon music for social media creators on short-form and online platforms, subject to Creator licence limits and active subscription requirements.',
    audience: 'TikTok, Instagram, Shorts and social-first content creators.',
    useCase: 'social media',
    primaryCta: 'Create with Aureon',
    secondaryCta: 'Listen to previews',
    intro: 'Aureon’s licence terms identify social media content as a possible Creator Licence use. These pages are designed to help creators understand the route to licensed music without claiming rights the current agreement does not grant.',
    supportedUses: [
      'Social media content where the Creator Licence applies.',
      'Short-form creator videos and social-first campaigns inside licence limits.',
      'Creator previews and downloads for production workflows, subject to the monthly action limit.',
    ],
    limits: [
      ...commonLimits,
      'Platform music libraries, social-network policies and third-party distribution rules may still apply.',
    ],
    faqs: [
      {
        question: 'Can I use Aureon music on social media?',
        answer: 'The Master Music Licensing Agreement states that Creator Licence permitted uses may include social media content. The use must stay within Aureon’s Creator Licence limits and requires an active Creator subscription.',
      },
      {
        question: 'Does this replace every social platform rule?',
        answer: 'No. Aureon can define its licence scope, but creators remain responsible for using platforms lawfully and within each platform’s own rules.',
      },
      ...commonFaqs,
    ],
  },
  {
    slug: 'music-for-commercial-videos',
    path: '/music-for-commercial-videos',
    title: 'Music for Commercial Videos',
    kicker: 'Commercial video licensing',
    seoTitle: 'Music for Commercial Videos | Aureon Commercial Licensing',
    description: 'Explore Aureon music for commercial videos, brand content, corporate productions and advertising projects with clear commercial licensing boundaries.',
    audience: 'Brands, agencies, businesses, production companies and creator-led commercial projects.',
    useCase: 'commercial videos',
    primaryCta: 'Review Creator membership',
    secondaryCta: 'Contact for commercial scope',
    intro: 'Commercial video use needs careful licence matching. Aureon’s terms allow Creator use for business promotional content within licence limits, while advertising, corporate, broadcast or larger commercial use may require a Commercial Licence or written approval.',
    supportedUses: [
      'Business promotional content where the Creator Licence clearly applies.',
      'Commercial, corporate, advertising and entertainment projects under the applicable Commercial Licensing Agreement.',
      'Projects requiring broader scope, media, territory, duration or audience coverage by written Aureon confirmation.',
    ],
    limits: [
      ...commonLimits,
      'Commercial licence fees and scope may depend on project type, territory, duration, media, audience size, commercial value, number of productions and industry sector.',
      'No commercial rights arise until the applicable payment has been successfully processed and the relevant licence is effective.',
    ],
    faqs: [
      {
        question: 'Can I use Aureon music in commercial videos?',
        answer: 'Aureon’s terms support business promotional content within Creator licence limits and commercial projects under the Commercial Licensing Agreement. Broader commercial, corporate, advertising or broadcast use should be confirmed through the applicable Commercial Licence.',
      },
      {
        question: 'Are TV, radio or broadcast rights included?',
        answer: 'No, not automatically. The Commercial Licensing Agreement states that broadcast rights must be expressly included in the applicable Commercial Licence.',
      },
      {
        question: 'When do commercial rights begin?',
        answer: 'The Commercial Licensing Agreement states that full payment must be received before licensed content may be used, and no commercial rights arise until payment has been successfully processed unless otherwise agreed in writing.',
      },
      ...commonFaqs,
    ],
  },
];

export const creatorLicensingPaths = creatorLicensingPages.map(page => page.path);

export function getCreatorLicensingPage(slug: string) {
  return creatorLicensingPages.find(page => page.slug === slug);
}

export function creatorLicensingMetadata(slug: string): Metadata {
  const page = getCreatorLicensingPage(slug)!;
  return {
    title: page.seoTitle,
    description: page.description,
    alternates: { canonical: `${SITE_URL}${page.path}` },
    openGraph: {
      title: page.seoTitle,
      description: page.description,
      url: `${SITE_URL}${page.path}`,
      siteName: 'Aureon Music Group',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.seoTitle,
      description: page.description,
    },
  };
}
