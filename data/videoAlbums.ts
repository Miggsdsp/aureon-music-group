export type MusicVideo = {
  title: string;
  file: string;
  type: string;
  duration: string;
};

export type VideoAlbum = {
  id: string;
  title: string;
  slug: string;
  artist: string;
  artistSlug: string;
  genre: string;
  cover: string;
  year: string;
  description: string;
  videos: MusicVideo[];
};

export const videoAlbums: VideoAlbum[] = [
  {
    id: 'VID001',
    title: 'Galactic',
    slug: 'galactic',
    artist: 'KAIVO',
    artistSlug: 'kaivo',
    genre: 'House / Ibiza',
    cover: '/images/artists/kaivo/KAIVO_Logo.png',
    year: '2026',
    description: 'Visualizers, studio sessions and behind-the-song videos for KAIVO’s Galactic release world.',
    videos: [
      { title: 'Galactic — Official Visualizer', file: 'galactic-visualizer.mp4', type: 'Official Visualizer', duration: '3:35' },
      { title: 'Galactic — Studio Session', file: 'galactic-studio-session.mp4', type: 'Studio Session', duration: '5:10' },
      { title: 'Galactic — Behind The Song', file: 'galactic-behind-the-song.mp4', type: 'Behind The Song', duration: '4:25' },
      { title: 'Midnight Orbit — Lyric Video', file: 'midnight-orbit-lyric.mp4', type: 'Lyric Video', duration: '3:42' },
      { title: 'Ibiza Signal — Studio Visual', file: 'ibiza-signal-studio.mp4', type: 'Studio Visual', duration: '3:28' }
    ]
  },
  {
    id: 'VID002',
    title: 'Eterno Capitão',
    slug: 'eterno-capitao',
    artist: 'MAREA',
    artistSlug: 'marea',
    genre: 'Portuguese',
    cover: '/images/artists/marea/MAREA_Logo.png',
    year: '2026',
    description: 'Portuguese cinematic visuals, studio sessions, lyric videos and behind-the-song stories.',
    videos: [
      { title: 'Eterno Capitão — Official Video', file: 'eterno-capitao-official.mp4', type: 'Official Video', duration: '3:50' },
      { title: 'Eterno Capitão — Studio Session', file: 'eterno-capitao-studio-session.mp4', type: 'Studio Session', duration: '5:20' },
      { title: 'Eterno Capitão — Behind The Song', file: 'eterno-capitao-behind-the-song.mp4', type: 'Behind The Song', duration: '4:40' },
      { title: 'Madeira Luz — Lyric Video', file: 'madeira-luz-lyric.mp4', type: 'Lyric Video', duration: '3:36' },
      { title: 'Mar De Saudade — Visualizer', file: 'mar-de-saudade-visualizer.mp4', type: 'Visualizer', duration: '3:44' }
    ]
  },
  {
    id: 'VID003',
    title: 'Under The Texan Sky',
    slug: 'under-the-texan-sky',
    artist: 'RYDER BLACKWOOD',
    artistSlug: 'ryder-blackwood',
    genre: 'Country',
    cover: '/images/artists/ryder-blackwood/RYDER_BLACKWOOD_Logo.png',
    year: '2026',
    description: 'Western music videos, studio sessions, ranch visuals, campfire lyric videos and behind-the-song storytelling clips.',
    videos: [
      { title: 'Under The Texan Sky — Official Video', file: 'under-the-texan-sky-official.mp4', type: 'Official Video', duration: '3:48' },
      { title: 'Under The Texan Sky — Studio Session', file: 'under-the-texan-sky-studio-session.mp4', type: 'Studio Session', duration: '5:35' },
      { title: 'Under The Texan Sky — Behind The Song', file: 'under-the-texan-sky-behind-the-song.mp4', type: 'Behind The Song', duration: '4:50' },
      { title: 'Dust On My Boots — Lyric Video', file: 'dust-on-my-boots-lyric.mp4', type: 'Lyric Video', duration: '3:40' },
      { title: 'Cowgirl Hips — Visualizer', file: 'cowgirl-hips-visualizer.mp4', type: 'Visualizer', duration: '3:22' }
    ]
  },
  {
    id: 'VID004',
    title: 'Love For The Herb',
    slug: 'love-for-the-herb',
    artist: 'GANJA BOY',
    artistSlug: 'gunjaboy',
    genre: 'Reggae',
    cover: '/images/artists/gunjaboy/GUNJA_BOY_Logo.png',
    year: '2026',
    description: 'Warm reggae visualizers, studio sessions, behind-the-song features, sunset clips and peaceful music-video releases.',
    videos: [
      { title: 'Love For The Herb — Official Visualizer', file: 'love-for-the-herb-visualizer.mp4', type: 'Official Visualizer', duration: '3:58' },
      { title: 'Love For The Herb — Studio Session', file: 'love-for-the-herb-studio-session.mp4', type: 'Studio Session', duration: '5:05' },
      { title: 'Love For The Herb — Behind The Song', file: 'love-for-the-herb-behind-the-song.mp4', type: 'Behind The Song', duration: '4:30' },
      { title: 'Ocean Smoke — Lyric Video', file: 'ocean-smoke-lyric.mp4', type: 'Lyric Video', duration: '3:33' },
      { title: 'Calmer Place — Sunset Visual', file: 'calmer-place-sunset.mp4', type: 'Sunset Visual', duration: '3:46' }
    ]
  },
  {
    id: 'VID005',
    title: 'Midnight Bottle',
    slug: 'midnight-bottle',
    artist: 'ASH CALDWELL',
    artistSlug: 'ash-caldwell',
    genre: 'Blues / Rock',
    cover: '/images/artists/ash-caldwell/ASH_CALDWELL_Logo.png',
    year: '2026',
    description: 'Smoky blues visuals, studio sessions, behind-the-song stories, late-night bar scenes and guitar-driven music videos.',
    videos: [
      { title: 'Midnight Bottle — Official Video', file: 'midnight-bottle-official.mp4', type: 'Official Video', duration: '3:52' },
      { title: 'Midnight Bottle — Studio Session', file: 'midnight-bottle-studio-session.mp4', type: 'Studio Session', duration: '5:15' },
      { title: 'Midnight Bottle — Behind The Song', file: 'midnight-bottle-behind-the-song.mp4', type: 'Behind The Song', duration: '4:38' },
      { title: 'Whiskey Memories — Lyric Video', file: 'whiskey-memories-lyric.mp4', type: 'Lyric Video', duration: '3:47' },
      { title: 'Cold Neon Bar — Visualizer', file: 'cold-neon-bar-visualizer.mp4', type: 'Visualizer', duration: '3:38' }
    ]
  }
];

export function getVideoAlbumBySlug(slug: string) {
  return videoAlbums.find((album) => album.slug === slug);
}

export function getVideoPath(album: VideoAlbum, video: MusicVideo) {
  return `/videos/albums/${album.slug}/${video.file}`;
}
