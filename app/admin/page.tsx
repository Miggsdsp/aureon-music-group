'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import {
  buildRevenueSummary,
  isIrelandBusinessDay,
  isPaidOrder,
  merchandiseQuantity,
  money,
  songQuantity,
} from '@/lib/admin-reporting';

type Row = Record<string, any>;

type Metrics = {
  revenueToday: number;
  paidOrders: number;
  subscriptionPaymentsToday: number;
  songSales: number;
  merchandiseSales: number;
  customers: number;
  downloads: number;
};

const initialMetrics: Metrics = {
  revenueToday: 0,
  paidOrders: 0,
  subscriptionPaymentsToday: 0,
  songSales: 0,
  merchandiseSales: 0,
  customers: 0,
  downloads: 0,
};

export default function AdminDashboardPage() {
  const { authorised, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Row[]>([]);
  const [subscriptionPayments, setSubscriptionPayments] = useState<Row[]>([]);
  const [refunds, setRefunds] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [downloads, setDownloads] = useState<Row[]>([]);
  const [connectedCollections, setConnectedCollections] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;

    setConnectedCollections(0);

    const markLive = () => {
      setConnectedCollections(current => Math.min(current + 1, 5));
      setLastUpdated(new Date());
      setDashboardError('');
    };

    const handleError = (error: unknown) => {
      console.error('Admin dashboard Firestore listener failed:', error);
      setDashboardError(
        'The dashboard could not read one or more secure collections. Please confirm the signed-in account is active in the Firestore admins collection.',
      );
    };

    const rows = (snapshot: any) => snapshot.docs.map((entry: any) => ({ id: entry.id, ...entry.data() }));

    const unsubscribers = [
      onSnapshot(collection(firestore, 'orders'), snapshot => { setOrders(rows(snapshot)); markLive(); }, handleError),
      onSnapshot(collection(firestore, 'subscriptionPayments'), snapshot => { setSubscriptionPayments(rows(snapshot)); markLive(); }, handleError),
      onSnapshot(collection(firestore, 'refunds'), snapshot => { setRefunds(rows(snapshot)); markLive(); }, handleError),
      onSnapshot(collection(firestore, 'customers'), snapshot => { setCustomers(rows(snapshot)); markLive(); }, handleError),
      onSnapshot(collection(firestore, 'downloads'), snapshot => { setDownloads(rows(snapshot)); markLive(); }, handleError),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const metrics = useMemo<Metrics>(() => {
    if (!authorised) return initialMetrics;

    const todayOrders = orders.filter(order => isIrelandBusinessDay(order.paidAt || order.createdAt));
    const todaySubscriptions = subscriptionPayments.filter(payment => isIrelandBusinessDay(payment.paidAt || payment.createdAt || payment.recordedAt));
    const todayRefunds = refunds.filter(refund => isIrelandBusinessDay(refund.refundedAt || refund.createdAt || refund.updatedAt));
    const todayRevenue = buildRevenueSummary(todayOrders, todaySubscriptions, todayRefunds);
    const paidOrders = orders.filter(isPaidOrder);
    const usedDownloads = downloads.filter(download => {
      return Number(download.downloadCount || 0) > 0 || Boolean(download.usedAt);
    }).length;

    return {
      revenueToday: todayRevenue.net,
      paidOrders: paidOrders.length,
      subscriptionPaymentsToday: todayRevenue.subscriptionPaymentCount,
      songSales: paidOrders.reduce((total, order) => total + songQuantity(order), 0),
      merchandiseSales: paidOrders.reduce((total, order) => total + merchandiseQuantity(order), 0),
      customers: customers.length,
      downloads: usedDownloads,
    };
  }, [authorised, orders, subscriptionPayments, refunds, customers, downloads]);

  const cards = useMemo(
    () => [
      ['Revenue today', money(metrics.revenueToday)],
      ['Paid orders', String(metrics.paidOrders)],
      ['Subscription payments today', String(metrics.subscriptionPaymentsToday)],
      ['Song sales', String(metrics.songSales)],
      ['Merchandise sales', String(metrics.merchandiseSales)],
      ['Customers', String(metrics.customers)],
      ['Completed downloads', String(metrics.downloads)],
    ],
    [metrics],
  );

  const dashboardLive = connectedCollections === 5;

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
              ? 'Orders, subscription payments, refunds, customers and completed downloads are subscribed to Firestore in real time.'
              : `Connected to ${connectedCollections} of 5 live data sources…`}
          </p>
          {lastUpdated && <p>Last update: {lastUpdated.toLocaleString()}</p>}
        </article>
        <article>
          <h2>Metrics update automatically</h2>
          <p>New paid orders, subscription charges, song sales, merchandise sales, customers and completed downloads appear without refreshing the page.</p>
        </article>
      </section>
    </AdminShell>
  );
}
