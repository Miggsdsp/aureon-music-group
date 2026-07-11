'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, FileText, ImagePlay, LayoutDashboard, LogOut, Menu, Music, Newspaper, Package, Settings, ShoppingBag, Users, X } from 'lucide-react';
import { canAccessSection, type AdminSection } from '@/lib/admin-permissions';
import { useAdminAuth } from './AdminAuthProvider';

const nav: Array<[string, string, React.ComponentType<{ size?: number }>, AdminSection]> = [
  ['Dashboard', '/admin', LayoutDashboard, 'dashboard'],
  ['Artists', '/admin/artists', Users, 'artists'],
  ['Albums', '/admin/albums', Boxes, 'albums'],
  ['Songs', '/admin/songs', Music, 'songs'],
  ['Videos', '/admin/videos', ImagePlay, 'videos'],
  ['News', '/admin/news', Newspaper, 'news'],
  ['Merchandise', '/admin/products', ShoppingBag, 'products'],
  ['Orders', '/admin/orders', Package, 'orders'],
  ['Pages', '/admin/pages', FileText, 'pages'],
  ['Analytics', '/admin/analytics', BarChart3, 'analytics'],
  ['Settings', '/admin/settings', Settings, 'settings']
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authorised, loading, admin, accessError, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !authorised) router.replace('/admin/login');
  }, [authorised, loading, router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const allowedNav = useMemo(
    () => admin ? nav.filter(([, , , section]) => canAccessSection(admin.role, section)) : [],
    [admin]
  );

  if (loading) return <main className="admin-loading">Checking secure access…</main>;
  if (!authorised) return <main className="admin-loading">{accessError || 'Redirecting to secure login…'}</main>;

  return (
    <div className="admin-app">
      <button className="admin-mobile-menu" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle admin navigation">
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <aside className={`admin-sidebar${menuOpen ? ' open' : ''}`}>
        <Link href="/admin" className="admin-brand" aria-label="Aureon Control Center dashboard">
          <Image
            src="/images/branding/Aureon_Header_Logo.png"
            alt="Aureon Music Group"
            width={520}
            height={180}
            priority
            className="admin-brand-logo"
          />
          <small>Control Center</small>
        </Link>
        <nav>
          {allowedNav.map(([label, href, Icon]) => {
            const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? 'active' : ''}><Icon size={18} />{label}</Link>;
          })}
        </nav>
        <button onClick={async () => { await logout(); router.replace('/admin/login'); }}><LogOut size={18} /> Sign out</button>
      </aside>

      {menuOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

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
