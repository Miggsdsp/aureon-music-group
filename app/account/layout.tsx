import { ContinueListening } from '@/components/discovery/ContinueListening';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ContinueListening /></>;
}
