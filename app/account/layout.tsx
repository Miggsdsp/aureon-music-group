import { DeleteAccountPanel } from '@/components/account/DeleteAccountPanel';
import { CommunityDashboard } from '@/components/community/CommunityDashboard';
import { ContinueListening } from '@/components/discovery/ContinueListening';
import { RecentlyPlayed } from '@/components/discovery/RecentlyPlayed';
import { ReferralCapture } from '@/components/referrals/ReferralCapture';
import { ReferralDashboard } from '@/components/referrals/ReferralDashboard';
import { AccountTrustMount } from '@/components/trust/AccountTrustMount';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <><ReferralCapture />{children}<DeleteAccountPanel /><AccountTrustMount /><CommunityDashboard /><ReferralDashboard /><ContinueListening /><RecentlyPlayed /></>;
}
