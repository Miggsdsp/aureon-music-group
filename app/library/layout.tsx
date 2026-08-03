import { ContinueListening } from '@/components/discovery/ContinueListening';
import { RecommendedPlaylists } from '@/components/discovery/RecommendedPlaylists';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ContinueListening /><RecommendedPlaylists memberOnly /></>;
}
