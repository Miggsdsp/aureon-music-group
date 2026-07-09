export type Artist = {
  id: string;
  name: string;
  slug: string;
  logo: string;
  genre: string;
  latest: string;
  latestFile: string;
  desc: string;
  bio: string;
  sound: string[];
};

export const artists: Artist[] = [
  {
    id: 'ART001',
    name: 'KAIVO',
    slug: 'kaivo',
    logo: 'KAIVO_Logo.png',
    genre: 'House / Ibiza',
    latest: 'Galactic',
    latestFile: 'galactic.mp3',
    desc: 'Bright island house with elegant club energy and cinematic sunset melodies.',
    bio: 'KAIVO is Aureon’s island-house identity, built for premium Ibiza nights, sunset sets and elegant electronic releases with a cinematic edge.',
    sound: ['Island house', 'Ibiza piano energy', 'Cinematic club atmosphere']
  },
  {
    id: 'ART002',
    name: 'MAREA',
    slug: 'marea',
    logo: 'MAREA_Logo.png',
    genre: 'Portuguese',
    latest: 'Eterno Capitão',
    latestFile: 'eterno-capitao.mp3',
    desc: 'Portuguese emotion, ocean warmth and timeless melodic storytelling.',
    bio: 'MAREA carries Portuguese soul, ocean emotion and heartfelt melodic storytelling for songs that feel proud, warm and timeless.',
    sound: ['Portuguese soul', 'Ocean warmth', 'Emotional melodies']
  },
  {
    id: 'ART003',
    name: 'SOLENTO',
    slug: 'solento',
    logo: 'SOLENTO_Logo.png',
    genre: 'Latin',
    latest: 'Sol De Amor',
    latestFile: 'sol-de-amor.mp3',
    desc: 'Latin heat, romance and rhythmic hooks built for global playlists.',
    bio: 'SOLENTO is a Latin-facing Aureon artist identity focused on romance, rhythm, heat and global hooks.',
    sound: ['Latin rhythm', 'Romantic hooks', 'Festival warmth']
  },
  {
    id: 'ART004',
    name: 'NURU',
    slug: 'nuru',
    logo: 'NURU_Logo.png',
    genre: 'Afro House',
    latest: 'Rise To Power',
    latestFile: 'rise-to-power.mp3',
    desc: 'Deep Afro House rhythm, ancestral warmth and premium dance-floor power.',
    bio: 'NURU blends deep Afro House rhythm with ancestral warmth, premium dance-floor movement and powerful chant-like energy.',
    sound: ['Afro House', 'Ancestral rhythm', 'Premium dance-floor energy']
  },
  {
    id: 'ART005',
    name: 'EONIX',
    slug: 'eonix',
    logo: 'EONIX_Logo.png',
    genre: 'Trance',
    latest: 'Beyond The Light',
    latestFile: 'beyond-the-light.mp3',
    desc: 'Futuristic trance with neon emotion and wide cinematic lifts.',
    bio: 'EONIX is the futuristic trance world of Aureon: neon emotion, wide synths, cinematic lifts and high-energy release moments.',
    sound: ['Trance', 'Neon synths', 'Cinematic lifts']
  },
  {
    id: 'ART006',
    name: 'RYDER BLACKWOOD',
    slug: 'ryder-blackwood',
    logo: 'RYDER_BLACKWOOD_Logo.png',
    genre: 'Country',
    latest: 'Under The Texan Sky',
    latestFile: 'under-the-texan-sky.mp3',
    desc: 'Modern country-pop stories with ranch soul, faith and big choruses.',
    bio: 'RYDER BLACKWOOD is Aureon’s modern western voice, built around ranch life, faith, struggle, love and big singalong choruses.',
    sound: ['Modern country', 'Western soul', 'Deep male vocal energy']
  },
  {
    id: 'ART007',
    name: 'GANJA BOY',
    slug: 'gunjaboy',
    logo: 'GUNJA_BOY_Logo.png',
    genre: 'Reggae',
    latest: 'Love For The Herb',
    latestFile: 'love-for-the-herb.mp3',
    desc: 'Authentic reggae calm, herb culture, soul and peaceful release.',
    bio: 'GANJA BOY is built around authentic reggae calm, heart, peaceful release and warm island grooves.',
    sound: ['Authentic reggae', 'Island groove', 'Relaxed soul']
  },
  {
    id: 'ART008',
    name: 'ASH CALDWELL',
    slug: 'ash-caldwell',
    logo: 'ASH_CALDWELL_Logo.png',
    genre: 'Blues / Rock',
    latest: 'Midnight Bottle',
    latestFile: 'midnight-bottle.mp3',
    desc: 'Whiskey-toned blues, late-night guitar and lived-in storytelling.',
    bio: 'ASH CALDWELL brings whiskey-toned blues, raw guitar, late-night stories and rugged emotional performance.',
    sound: ['Blues rock', 'Whiskey vocal tone', 'Late-night guitar']
  },
  {
    id: 'ART009',
    name: 'STARLIGHT',
    slug: 'starlight',
    logo: 'STARLIGHT_Logo.png',
    genre: "80's - 90's Pop",
    latest: 'Neon Forever',
    latestFile: 'neon-forever.mp3',
    desc: 'Retro pop glow, nostalgic hooks and radio-ready sparkle.',
    bio: 'STARLIGHT is Aureon’s retro-pop identity, inspired by neon nostalgia, big hooks and polished radio emotion.',
    sound: ['Synthwave pop', 'Neon nostalgia', 'Radio-ready hooks']
  },
  {
    id: 'ART010',
    name: 'EVERSTONE',
    slug: 'everstone',
    logo: 'EVERSTONE_Logo.png',
    genre: 'Soft Rock',
    latest: 'Hold On Tonight',
    latestFile: 'hold-on-tonight.mp3',
    desc: 'Emotional soft rock with big melodies and timeless heart.',
    bio: 'EVERSTONE represents timeless soft rock: emotional lyrics, big melodies, classic spirit and heartfelt choruses.',
    sound: ['Soft rock', 'Classic choruses', 'Emotional guitar melodies']
  }
];

export function getArtistBySlug(slug: string) {
  return artists.find((artist) => artist.slug === slug);
}

export function getArtistAudioPath(artist: Artist) {
  return `/music/artists/${artist.slug}/${artist.latestFile}`;
}
