export type Song = {
  title: string;
  file: string;
  duration: string;
};

export type Album = {
  id: string;
  title: string;
  slug: string;
  artist: string;
  artistSlug: string;
  genre: string;
  cover: string;
  year: string;
  description: string;
  songs: Song[];
};

export const albums: Album[] = [
  {
    id: 'ALB001',
    title: 'Galactic',
    slug: 'galactic',
    artist: 'KAIVO',
    artistSlug: 'kaivo',
    genre: 'House / Ibiza',
    cover: '/images/artists/kaivo/KAIVO_Logo.png',
    year: '2026',
    description: 'Premium Ibiza house energy with cinematic synths, island atmosphere and bright club movement.',
    songs: [
      { title: 'Galactic', file: 'galactic.mp3', duration: '3:35' },
      { title: 'Midnight Orbit', file: 'midnight-orbit.mp3', duration: '3:42' },
      { title: 'Ibiza Signal', file: 'ibiza-signal.mp3', duration: '3:28' }
    ]
  },
  {
    id: 'ALB002',
    title: 'Eterno Capitão',
    slug: 'eterno-capitao',
    artist: 'MAREA',
    artistSlug: 'marea',
    genre: 'Portuguese',
    cover: '/images/artists/marea/MAREA_Logo.png',
    year: '2026',
    description: 'Portuguese emotion, pride and ocean warmth built around timeless melody and heartfelt performance.',
    songs: [
      { title: 'Eterno Capitão', file: 'eterno-capitao.mp3', duration: '3:50' },
      { title: 'Madeira Luz', file: 'madeira-luz.mp3', duration: '3:36' },
      { title: 'Mar De Saudade', file: 'mar-de-saudade.mp3', duration: '3:44' }
    ]
  },
  {
    id: 'ALB003',
    title: 'Under The Texan Sky',
    slug: 'under-the-texan-sky',
    artist: 'RYDER BLACKWOOD',
    artistSlug: 'ryder-blackwood',
    genre: 'Country',
    cover: '/images/artists/ryder-blackwood/RYDER_BLACKWOOD_Logo.png',
    year: '2026',
    description: 'Modern western storytelling, ranch soul, faith, campfire emotion and huge country hooks.',
    songs: [
      { title: 'Under The Texan Sky', file: 'under-the-texan-sky.mp3', duration: '3:48' },
      { title: 'Dust On My Boots', file: 'dust-on-my-boots.mp3', duration: '3:40' },
      { title: 'Cowgirl Hips', file: 'cowgirl-hips.mp3', duration: '3:22' }
    ]
  },
  {
    id: 'ALB004',
    title: 'Love For The Herb',
    slug: 'love-for-the-herb',
    artist: 'GANJA BOY',
    artistSlug: 'gunjaboy',
    genre: 'Reggae',
    cover: '/images/artists/gunjaboy/GUNJA_BOY_Logo.png',
    year: '2026',
    description: 'Authentic reggae calm, warm grooves, peaceful release and soulful island feeling.',
    songs: [
      { title: 'Love For The Herb', file: 'love-for-the-herb.mp3', duration: '3:58' },
      { title: 'Ocean Smoke', file: 'ocean-smoke.mp3', duration: '3:33' },
      { title: 'Calmer Place', file: 'calmer-place.mp3', duration: '3:46' }
    ]
  },
  {
    id: 'ALB005',
    title: 'Midnight Bottle',
    slug: 'midnight-bottle',
    artist: 'ASH CALDWELL',
    artistSlug: 'ash-caldwell',
    genre: 'Blues / Rock',
    cover: '/images/artists/ash-caldwell/ASH_CALDWELL_Logo.png',
    year: '2026',
    description: 'Whiskey-toned blues, raw guitar, smoky vocals and late-night emotional storytelling.',
    songs: [
      { title: 'Midnight Bottle', file: 'midnight-bottle.mp3', duration: '3:52' },
      { title: 'Whiskey Memories', file: 'whiskey-memories.mp3', duration: '3:47' },
      { title: 'Cold Neon Bar', file: 'cold-neon-bar.mp3', duration: '3:38' }
    ]
  }
];

export function getAlbumBySlug(slug: string) {
  return albums.find((album) => album.slug === slug);
}

export function getSongAudioPath(album: Album, song: Song) {
  return `/music/albums/${album.slug}/${song.file}`;
}
