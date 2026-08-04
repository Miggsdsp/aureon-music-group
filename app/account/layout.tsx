import { ContinueListening } from '@/components/discovery/ContinueListening';
import { RecentlyPlayed } from '@/components/discovery/RecentlyPlayed';
import { ReferralDashboard } from '@/components/referrals/ReferralDashboard';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ReferralDashboard /><ContinueListening /><RecentlyPlayed /></>;
}
