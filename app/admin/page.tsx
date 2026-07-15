'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Metrics = {
  revenue: number;
  orders: number;
  songSales: number;
  merchandiseSales: number;
  customers: number;
  downloads: number;
};

const initialMetrics: Metrics = {
  revenue: 0,
  orders: 0,
  songSales: 0,
  merchandiseSales: 0,
  customers: 0,
  downloads: 0
};

export default function AdminDashboardPage() {
  const { authorised, loading } = useAdminAuth();
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [connected, setConnected] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;

    const unsubscribers: Array<() => void> = [];
    const orderRows: Array<Record<string, unknown>> = [];
    const handleError = (error: unknown) => {
      console.error('Admin dashboard Firestore listener failed:', error);
      setDashboardError('The dashboard could not read one or more secure collections. Please confirm the signed-in account is active in the Firestore admins collection.');
    };

    unsubscribers.push(onSnapshot(collection(firestore, 'orders'), (snapshot) => {
      orderRows.splice(0, orderRows.length, ...snapshot.docs.map((entry) => entry.data()));
      const revenue = orderRows.reduce((total, order) => total + Number(order.total || order.amount || 0), 0);
      const songSales = orderRows.filter((order) => order.type === 'song' || order.orderType === 'song').length;
      const merchandiseSales = orderRows.filter((order) => order.type === 'merchandise' || order.orderType === 'merchandise').length;
      setMetrics((current) => ({ ...current, orders: snapshot.size, revenue, songSales, merchandiseSales }));
      setConnected(true);
      setDashboardError('');
    }, handleError));

    unsubscribers.push(onSnapshot(collection(firestore, 'customers'), (snapshot) => {
      setMetrics((current) => ({ ...current, customers: snapshot.size }));
    }, handleError));

    unsubscribers.push(onSnapshot(collection(firestore, 'downloads'), (snapshot) => {
      setMetrics((current) => ({ ...current, downloads: snapshot.size }));
    }, handleError));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authorised, loading]);

  const cards = useMemo(() => [
    ['Revenue today', `€${metrics.revenue.toFixed(2)}`],
    ['Orders', String(metrics.orders)],
    ['Song sales', String(metrics.songSales)],
    ['Merchandise sales', String(metrics.merchandiseSales)],
    ['Customers', String(metrics.customers)],
    ['Downloads', String(metrics.downloads)]
  ], [metrics]);

  return (
    <AdminShell>
      <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>Dashboard</h1><p>Secure operations overview for Aureon Music Group.</p></div>
      {dashboardError && <div className="admin-cms-message">{dashboardError}</div>}
      <section className="admin-stat-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="admin-dashboard-grid">
        <article><h2>Backend connected</h2><p>{connected ? 'Firebase Authentication, Firestore and Storage are operational.' : 'Connecting securely to Firebase…'}</p></article>
        <article><h2>Content management live</h2><p>Use the sidebar to create, edit, publish, hide and delete website content.</p></article>
      </section>
    </AdminShell>
  );
}
