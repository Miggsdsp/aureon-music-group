import { ContinueListening } from '@/components/discovery/ContinueListening';
import { RecentlyPlayed } from '@/components/discovery/RecentlyPlayed';
import { ReferralCapture } from '@/components/referrals/ReferralCapture';
import { ReferralDashboard } from '@/components/referrals/ReferralDashboard';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <><ReferralCapture />{children}<ReferralDashboard /><ContinueListening /><RecentlyPlayed /></>;
}
