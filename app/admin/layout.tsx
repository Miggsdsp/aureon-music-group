import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider';
import './admin-layout-fixes.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
