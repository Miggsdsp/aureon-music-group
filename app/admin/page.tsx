'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Row = Record<string, any>;

type Metrics = {
  revenueToday: number;
  paidOrders: number;
  songSales: number;
  merchandiseSales: number;
  customers: number;
  downloads: number;
};

const initialMetrics: Metrics = {
  revenueToday: 0,
  paidOrders: 0,
  songSales: 0,
  merchandiseSales: 0,
  customers: 0,
  downloads: 0,
};

const asDate = (value: any) => value?.toDate?.() || new Date(value || 0);
const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value.getTime();
};

function isPaid(order: Row) {
  return String(order.status || order.paymentStatus || '').toLowerCase() === 'paid';
}

function orderTotal(order: Row) {
  return Number(order.amountTotal ?? order.total ?? order.amount ?? 0);
}

function songQuantity(order: Row) {
  if (Array.isArray(order.songs)) {
    return order.songs.reduce((total: number, song: Row) => total + Number(song.quantity || 1), 0);
  }
  if (order.type === 'song' || order.orderType === 'song') return Number(order.quantity || 1);
  return 0;
}

function merchandiseQuantity(order: Row) {
  if (Array.isArray(order.items)) {
    return order.items
      .filter((item: Row) => !item.digital)
      .reduce((total: number, item: Row) => total + Number(item.quantity || 1), 0);
  }
  if (order.type === 'merchandise' || order.orderType === 'merchandise') return Number(order.quantity || 1);
  return 0;
}

export default function AdminDashboardPage() {
  const { authorised, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [downloads, setDownloads] = useState<Row[]>([]);
  const [connectedCollections, setConnectedCollections] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;

    setConnectedCollections(0);

    const markLive = () => {
      setConnectedCollections(current => Math.min(current + 1, 3));
      setLastUpdated(new Date());
      setDashboardError('');
    };

    const handleError = (error: unknown) => {
      console.error('Admin dashboard Firestore listener failed:', error);
      setDashboardError(
        'The dashboard could not read one or more secure collections. Please confirm the signed-in account is active in the Firestore admins collection.',
      );
    };

    const unsubscribers = [
      onSnapshot(
        collection(firestore, 'orders'),
        snapshot => {
          setOrders(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })));
          markLive();
        },
        handleError,
      ),
      onSnapshot(
        collection(firestore, 'customers'),
        snapshot => {
          setCustomers(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })));
          markLive();
        },
        handleError,
      ),
      onSnapshot(
        collection(firestore, 'downloads'),
        snapshot => {
          setDownloads(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })));
          markLive();
        },
        handleError,
      ),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const metrics = useMemo<Metrics>(() => {
    if (!authorised) return initialMetrics;

    const paidOrders = orders.filter(isPaid);
    const todayStart = startOfToday();
    const revenueToday = paidOrders
      .filter(order => asDate(order.paidAt || order.createdAt).getTime() >= todayStart)
      .reduce((total, order) => total + orderTotal(order), 0);

    const songSales = paidOrders.reduce((total, order) => total + songQuantity(order), 0);
    const merchandiseSales = paidOrders.reduce((total, order) => total + merchandiseQuantity(order), 0);
    const usedDownloads = downloads.filter(download => {
      return Number(download.downloadCount || 0) > 0 || Boolean(download.usedAt);
    }).length;

    return {
      revenueToday,
      paidOrders: paidOrders.length,
      songSales,
      merchandiseSales,
      customers: customers.length,
      downloads: usedDownloads,
    };
  }, [authorised, orders, customers, downloads]);

  const cards = useMemo(
    () => [
      ['Revenue today', `€${(metrics.revenueToday / 100).toFixed(2)}`],
      ['Paid orders', String(metrics.paidOrders)],
      ['Song sales', String(metrics.songSales)],
      ['Merchandise sales', String(metrics.merchandiseSales)],
      ['Customers', String(metrics.customers)],
      ['Completed downloads', String(metrics.downloads)],
    ],
    [metrics],
  );

  const dashboardLive = connectedCollections === 3;

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Aureon Control Center</p>
        <h1>Dashboard</h1>
        <p>Live secure operations overview for Aureon Music Group.</p>
      </div>

      {dashboardError && <div className="admin-cms-message">{dashboardError}</div>}

      <section className="admin-stat-grid" aria-live="polite">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-dashboard-grid">
        <article>
          <h2>{dashboardLive ? 'Live connection active' : 'Connecting securely'}</h2>
          <p>
            {dashboardLive
              ? 'Orders, customers and completed downloads are subscribed to Firestore in real time.'
              : `Connected to ${connectedCollections} of 3 live data sources…`}
          </p>
          {lastUpdated && <p>Last update: {lastUpdated.toLocaleString()}</p>}
        </article>
        <article>
          <h2>Metrics update automatically</h2>
          <p>New paid orders, song sales, merchandise sales, customers and completed downloads appear without refreshing the page.</p>
        </article>
      </section>
    </AdminShell>
  );
}
