import { ContinueListening } from '@/components/discovery/ContinueListening';
import { RecentlyPlayed } from '@/components/discovery/RecentlyPlayed';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ContinueListening /><RecentlyPlayed /></>;
}
