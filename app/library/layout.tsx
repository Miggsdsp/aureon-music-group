import { ContinueListening } from '@/components/discovery/ContinueListening';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ContinueListening /></>;
}
