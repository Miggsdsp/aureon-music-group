'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Download, Printer } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { firestore } from '@/lib/firebase-client';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Row = { id: string; [key: string]: any };
type Period = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
const asDate = (value: any) => value?.toDate?.() || new Date(value || 0);
const money = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(Number(value || 0) / 100);
const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function range(period: Period, customStart: string, customEnd: string) {
  const now = new Date();
  const end = new Date(now); end.setHours(23,59,59,999);
  let start = new Date(now); start.setHours(0,0,0,0);
  if (period === 'yesterday') { start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); }
  if (period === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'quarter') start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
  if (period === 'custom') {
    if (customStart) start = new Date(`${customStart}T00:00:00`);
    if (customEnd) { const value = new Date(`${customEnd}T23:59:59`); end.setTime(value.getTime()); }
  }
  return { start, end };
}

function add(map: Map<string, any>, key: string, revenue: number, sales = 1, country?: string) {
  const name = key || 'Not captured';
  const item = map.get(name) || { name, revenue: 0, sales: 0, countries: new Map<string, number>() };
  item.revenue += revenue; item.sales += sales;
  if (country) item.countries.set(country, (item.countries.get(country) || 0) + sales);
  map.set(name, item);
}

export default function PerformancePage() {
  const { authorised, loading } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [orders, setOrders] = useState<Row[]>([]);
  const [members, setMembers] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [refunds, setRefunds] = useState<Row[]>([]);
  const [selectedSong, setSelectedSong] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    const convert = (snapshot: any) => snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() }));
    const fail = (error: unknown) => { console.error(error); setMessage('Some performance sources could not be loaded.'); };
    const unsubscribers = [
      onSnapshot(collection(firestore, 'orders'), snapshot => setOrders(convert(snapshot)), fail),
      onSnapshot(collection(firestore, 'members'), snapshot => setMembers(convert(snapshot)), fail),
      onSnapshot(collection(firestore, 'payments'), snapshot => setPayments(convert(snapshot)), () => setPayments([])),
      onSnapshot(collection(firestore, 'refunds'), snapshot => setRefunds(convert(snapshot)), () => setRefunds([])),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const dateRange = useMemo(() => range(period, customStart, customEnd), [period, customStart, customEnd]);
  const inRange = (value: any) => { const time = asDate(value).getTime(); return time >= dateRange.start.getTime() && time <= dateRange.end.getTime(); };

  const report = useMemo(() => {
    const paid = orders.filter(order => String(order.status || order.paymentStatus).toLowerCase() === 'paid' && inRange(order.paidAt || order.createdAt));
    const songs = new Map<string, any>(); const artists = new Map<string, any>(); const albums = new Map<string, any>();
    const countries = new Map<string, any>(); const products = new Map<string, any>();
    let gross = 0; let fees = 0;
    const customerOrders = new Map<string, number>();
    for (const order of paid) {
      const total = Number(order.amountTotal || 0); const fee = Number(order.stripeFee || order.feeAmount || 0);
      const country = String(order.country || order.customerCountry || order.shippingAddress?.country || 'Not captured');
      const email = String(order.customerEmail || '').toLowerCase();
      gross += total; fees += fee; if (email) customerOrders.set(email, (customerOrders.get(email) || 0) + 1);
      add(countries, country, total);
      const music = Array.isArray(order.songs) ? order.songs : [];
      for (const song of music) {
        const quantity = Number(song.quantity || 1); const revenue = Number(song.unitAmount || 0) * quantity || Math.round(total / Math.max(1, music.length));
        add(songs, String(song.title || song.name || song.id), revenue, quantity, country);
        add(artists, String(song.artist || song.artistName || 'Unknown artist'), revenue, quantity, country);
        add(albums, String(song.albumTitle || 'Singles / no album'), revenue, quantity, country);
      }
      for (const product of Array.isArray(order.items) ? order.items.filter((item: any) => !item.digital) : []) {
        add(products, String(product.name || product.title || product.id), Number(product.unitAmount || product.price || 0) * Number(product.quantity || 1), Number(product.quantity || 1), country);
      }
    }
    const sorted = (map: Map<string, any>) => [...map.values()].map(item => ({ ...item, topCountries: [...item.countries.entries()].sort((a:any,b:any)=>b[1]-a[1]) })).sort((a,b) => b.revenue - a.revenue || b.sales - a.sales);
    const active = members.filter(member => ['active','trialing'].includes(String(member.subscriptionStatus).toLowerCase()));
    const cancellations = members.filter(member => (member.cancelAtPeriodEnd || String(member.subscriptionStatus).toLowerCase() === 'cancelled') && inRange(member.updatedAt || member.cancelledAt)).length;
    const failedPayments = payments.filter(payment => ['failed','past_due','unpaid'].includes(String(payment.status).toLowerCase()) && inRange(payment.createdAt || payment.updatedAt)).length;
    const refundTotal = refunds.filter(refund => inRange(refund.createdAt || refund.updatedAt)).reduce((sum, refund) => sum + Number(refund.amount || refund.amountRefunded || 0), 0);
    const newCustomers = [...customerOrders.values()].filter(count => count === 1).length;
    const returningCustomers = [...customerOrders.values()].filter(count => count > 1).length;
    const plans = active.reduce((map: Record<string,number>, member) => { const key = String(member.plan || 'unknown'); map[key] = (map[key] || 0) + 1; return map; }, {});
    return { gross, fees, refunds: refundTotal, net: gross - fees - refundTotal, orders: paid.length, newCustomers, returningCustomers, active: active.length, plans, cancellations, failedPayments, songs: sorted(songs), artists: sorted(artists), albums: sorted(albums), countries: sorted(countries), products: sorted(products) };
  }, [orders, members, payments, refunds, dateRange]);

  const chosen = report.songs.find((item: any) => item.name === selectedSong) || report.songs[0];
  const summary = [
    ['Gross revenue', money(report.gross)], ['Stripe fees', money(report.fees)], ['Refunds', money(report.refunds)], ['Net revenue', money(report.net)], ['Orders', report.orders], ['New customers', report.newCustomers], ['Returning customers', report.returningCustomers], ['Active subscriptions', report.active], ['Cancellations', report.cancellations], ['Failed payments', report.failedPayments],
  ];

  function exportCsv() {
    const rows: unknown[][] = [['Aureon Music Group Performance'], ['From', dateRange.start.toLocaleString('en-IE')], ['To', dateRange.end.toLocaleString('en-IE')], [], ...summary, [], ['Subscriptions by plan'], ...Object.entries(report.plans), [], ['Song','Sales','Revenue','Top country'], ...report.songs.map((item:any)=>[item.name,item.sales,item.revenue/100,item.topCountries[0]?.[0] || 'Not captured']), [], ['Artist','Sales','Revenue'], ...report.artists.map((item:any)=>[item.name,item.sales,item.revenue/100]), [], ['Album','Sales','Revenue'], ...report.albums.map((item:any)=>[item.name,item.sales,item.revenue/100]), [], ['Merchandise','Sales','Revenue'], ...report.products.map((item:any)=>[item.name,item.sales,item.revenue/100])];
    const blob = new Blob(['\ufeff', rows.map(row => row.map(csv).join(',')).join('\n')], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href=url; anchor.download=`Aureon-Performance-${new Date().toISOString()}.csv`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  const table = (title: string, data: any[]) => <article><h2>{title}</h2><div className="admin-table-wrap"><table><thead><tr><th>Name</th><th>Sales</th><th>Revenue</th><th>Top country</th></tr></thead><tbody>{data.length ? data.slice(0,20).map(item => <tr key={item.name}><td>{item.name}</td><td>{item.sales}</td><td>{money(item.revenue)}</td><td>{item.topCountries?.[0]?.[0] || '—'}</td></tr>) : <tr><td colSpan={4}>No data for this period.</td></tr>}</tbody></table></div></article>;

  return <AdminShell><div className="admin-page-heading"><p className="admin-kicker">Marketing intelligence</p><h1>Performance Analytics</h1><p>Subscription movement, catalogue performance, geography and merchandise results in real time.</p></div>
    {message && <div className="admin-cms-message">{message}</div>}
    <div className="admin-toolbar"><label>Period <select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option><option value="custom">Custom</option></select></label>{period === 'custom' && <><label>From <input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)}/></label><label>To <input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)}/></label></>}<button onClick={exportCsv}><Download size={15}/> CSV</button><button onClick={() => globalThis.print()}><Printer size={15}/> Print</button></div>
    <section className="admin-stat-grid">{summary.map(([label,value]) => <article key={String(label)}><span>{label}</span><strong>{String(value)}</strong></article>)}</section>
    <section className="admin-dashboard-grid"><article><h2>Subscriptions by plan</h2>{Object.keys(report.plans).length ? Object.entries(report.plans).map(([plan,count]) => <p key={plan}><strong>{plan}</strong>: {count}</p>) : <p>No active subscriptions.</p>}</article><article><h2>Individual song geography</h2><select value={chosen?.name || ''} onChange={event => setSelectedSong(event.target.value)}>{report.songs.map((item:any)=><option key={item.name}>{item.name}</option>)}</select>{chosen?.topCountries?.length ? chosen.topCountries.map(([country,count]:any)=><p key={country}>{country}: <strong>{count}</strong></p>) : <p>No country data.</p>}</article></section>
    <section className="admin-dashboard-grid">{table('Top songs',report.songs)}{table('Top artists',report.artists)}{table('Top albums',report.albums)}{table('Merchandise performance',report.products)}{table('Country performance',report.countries)}</section>
  </AdminShell>;
}
