import type { PlayerSong } from '@/components/music/MusicPlayerProvider';

export function shufflePlaylist<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function formatPlaylistDuration(songs: readonly PlayerSong[]): string {
  const seconds = songs.reduce((total, song) => total + (Number.isFinite(song.duration) ? Number(song.duration) : 0), 0);
  if (!seconds) return 'Duration unavailable';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}
