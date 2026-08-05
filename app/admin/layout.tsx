import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider';
import { AdminCacheInvalidationBridge } from '@/components/admin/AdminCacheInvalidationBridge';
import './admin-layout-fixes.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider><AdminCacheInvalidationBridge />{children}</AdminAuthProvider>;
}
