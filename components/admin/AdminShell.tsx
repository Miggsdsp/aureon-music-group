'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { BarChart3, Boxes, FileText, ImagePlay, LayoutDashboard, LogOut, Music, Newspaper, Package, Settings, ShoppingBag, Users } from 'lucide-react';
import { useAdminAuth } from './AdminAuthProvider';

const nav = [
  ['Dashboard', '/admin', LayoutDashboard],
  ['Artists', '/admin/artists', Users],
  ['Albums', '/admin/albums', Boxes],
  ['Songs', '/admin/songs', Music],
  ['Videos', '/admin/videos', ImagePlay],
  ['News', '/admin/news', Newspaper],
  ['Merchandise', '/admin/products', ShoppingBag],
  ['Orders', '/admin/orders', Package],
  ['Pages', '/admin/pages', FileText],
  ['Analytics', '/admin/analytics', BarChart3],
  ['Settings', '/admin/settings', Settings]
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authorised, loading, admin, logout } = useAdminAuth();

  useEffect(() => {
    if (!loading && !authorised) router.replace('/admin/login');
  }, [authorised, loading, router]);

  if (loading) return <main className="admin-loading">Checking secure access…</main>;
  if (!authorised) return null;

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>A</span>
          <div><strong>Aureon</strong><small>Control Center</small></div>
        </div>
        <nav>
          {nav.map(([label, href, Icon]) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={18} />{label}</Link>;
          })}
        </nav>
        <button onClick={async () => { await logout(); router.replace('/admin/login'); }}><LogOut size={18} /> Sign out</button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><p>Secure workspace</p><strong>{admin?.name || admin?.email}</strong></div>
          <span>{admin?.role}</span>
        </header>
        <div className="admin-content">{children}</div>
      </section>
    </div>
  );
}
