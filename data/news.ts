export type NewsArticle = {
  id: string;
  slug: string;
  category: 'Artists' | 'Releases' | 'Videos' | 'Company' | 'Behind The Song';
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  artistSlug?: string;
  body: string[];
};

export const newsArticles: NewsArticle[] = [
  {
    id: 'NEWS001',
    slug: 'kaivo-galactic-new-era',
    category: 'Releases',
    title: 'KAIVO Opens a New Electronic Era with Galactic',
    excerpt: 'Aureon Music Group introduces KAIVO’s cinematic Ibiza sound through the first Galactic release chapter.',
    date: '10 July 2026',
    readTime: '3 min read',
    image: '/images/artists/kaivo/KAIVO_Logo.png',
    artistSlug: 'kaivo',
    body: [
      'KAIVO’s Galactic project marks the beginning of a premium electronic chapter for Aureon Music Group.',
      'The release combines bright island-house energy, cinematic synth movement and a polished Ibiza atmosphere designed for playlists, clubs and visual content.',
      'The Galactic campaign will expand through official visualizers, studio sessions and behind-the-song content.'
    ]
  },
  {
    id: 'NEWS002',
    slug: 'ryder-blackwood-under-the-texan-sky',
    category: 'Artists',
    title: 'Ryder Blackwood Brings Ranch Soul to Under The Texan Sky',
    excerpt: 'The Aureon country artist returns with a heartfelt western story built around faith, gratitude and life on the ranch.',
    date: '8 July 2026',
    readTime: '4 min read',
    image: '/images/artists/ryder-blackwood/RYDER_BLACKWOOD_Logo.png',
    artistSlug: 'ryder-blackwood',
    body: [
      'Under The Texan Sky captures Ryder Blackwood at his most personal and cinematic.',
      'The song follows the end of a demanding day on the ranch before moving into a quiet moment beside a warm fire beneath the stars.',
      'Its deep vocal character, modern country production and memorable chorus are central to Ryder’s evolving identity.'
    ]
  },
  {
    id: 'NEWS003',
    slug: 'marea-eterno-capitao',
    category: 'Releases',
    title: 'MAREA Celebrates Portuguese Pride with Eterno Capitão',
    excerpt: 'A powerful Portuguese release shaped by ocean warmth, national pride and emotional melodic storytelling.',
    date: '6 July 2026',
    readTime: '3 min read',
    image: '/images/artists/marea/MAREA_Logo.png',
    artistSlug: 'marea',
    body: [
      'MAREA’s Eterno Capitão is built as a celebration of Portuguese identity, achievement and enduring inspiration.',
      'The production blends heartfelt vocals, Latin warmth and a melodic structure designed to connect with listeners in Portugal and around the world.',
      'Aureon will support the release with lyric video, visual storytelling and social campaign content.'
    ]
  },
  {
    id: 'NEWS004',
    slug: 'aureon-launches-studio-sessions',
    category: 'Videos',
    title: 'Aureon Launches Studio Sessions and Behind The Song',
    excerpt: 'Two new video formats will take audiences inside the creative process behind Aureon releases.',
    date: '4 July 2026',
    readTime: '2 min read',
    image: '/images/branding/Aureon_Header_Logo.png',
    body: [
      'Aureon Music Group is expanding its visual catalogue with dedicated Studio Sessions and Behind The Song features.',
      'Studio Sessions will showcase performance, production and creative atmosphere, while Behind The Song will explore meaning, inspiration and the decisions behind each release.',
      'Both formats will appear inside the Videos section alongside official videos, lyric videos and visualizers.'
    ]
  },
  {
    id: 'NEWS005',
    slug: 'aureon-digital-label-vision',
    category: 'Company',
    title: 'Aureon Builds a Modern Digital-First Record Label',
    excerpt: 'The company is creating a connected platform for artists, albums, videos, direct sales and fan relationships.',
    date: '1 July 2026',
    readTime: '5 min read',
    image: '/images/branding/Aureon_Header_Logo.png',
    body: [
      'Aureon Music Group is being developed as a digital-first independent label with a strong focus on ownership, presentation and direct audience relationships.',
      'The platform will connect artist profiles, music catalogues, video albums, news, merchandise and future direct purchasing options.',
      'The goal is to give every artist a distinctive identity while maintaining one premium Aureon standard across the full catalogue.'
    ]
  }
];

export function getNewsArticle(slug: string) {
  return newsArticles.find((article) => article.slug === slug);
}
