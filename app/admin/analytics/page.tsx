'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';
type Row = Record<string, any>;
type Range = { start: Date; end: Date; label: string };

const asDate = (value: any) => value?.toDate?.() || new Date(value || 0);
const money = (cents: number) => `€${(Number(cents || 0) / 100).toFixed(2)}`;
const dayStart = (date: Date) => { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; };
const dayEnd = (date: Date) => { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; };
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const htmlEscape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const countryNames: Record<string, string> = {
  IE: 'Ireland', GB: 'United Kingdom', US: 'United States', PT: 'Portugal', ES: 'Spain',
  FR: 'France', DE: 'Germany', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', BR: 'Brazil',
  ZA: 'South Africa', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', MX: 'Mexico',
  AE: 'United Arab Emirates', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', PL: 'Poland', GR: 'Greece', JP: 'Japan', IN: 'India',
};

function countryLabel(value: unknown) {
  const code = String(value || '').trim().toUpperCase();
  if (!code || code === 'UNKNOWN' || code === 'NOT CAPTURED') return 'Not captured — legacy order';
  return countryNames[code] || code;
}

function rangeFor(period: Period, customStart: string, customEnd: string): Range {
  const now = new Date();
  let start = dayStart(now);
  let end = dayEnd(now);
  let label = 'Today';
  if (period === 'yesterday') { const date = new Date(now); date.setDate(date.getDate() - 1); start = dayStart(date); end = dayEnd(date); label = 'Yesterday'; }
  if (period === '7d') { start = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); label = 'Last 7 days'; }
  if (period === '30d') { start = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); label = 'Last 30 days'; }
  if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); label = 'This month'; }
  if (period === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth(), 0)); label = 'Last month'; }
  if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); label = 'This quarter'; }
  if (period === 'year') { start = new Date(now.getFullYear(), 0, 1); label = 'This year'; }
  if (period === 'custom') {
    start = customStart ? dayStart(new Date(`${customStart}T00:00:00`)) : dayStart(now);
    end = customEnd ? dayEnd(new Date(`${customEnd}T00:00:00`)) : dayEnd(now);
    label = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }
  return { start, end, label };
}

function groupAdd(map: Map<string, { name: string; sales: number; revenue: number }>, name: string, sales: number, revenue: number) {
  const key = name || 'Not captured — legacy order';
  const current = map.get(key) || { name: key, sales: 0, revenue: 0 };
  current.sales += sales;
  current.revenue += revenue;
  map.set(key, current);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

export default function AnalyticsPage() {
  const { authorised, loading } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [orders, setOrders] = useState<Row[]>([]);
  const [downloads, setDownloads] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    const fail = (snapshotError: unknown) => { console.error(snapshotError); setError('Unable to read analytics. Confirm administrator permissions.'); };
    const unsubscribers = [
      onSnapshot(collection(firestore, 'orders'), snapshot => setOrders(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), fail),
      onSnapshot(collection(firestore, 'downloads'), snapshot => setDownloads(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), fail),
      onSnapshot(collection(firestore, 'customers'), snapshot => setCustomers(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), fail),
      onSnapshot(collection(firestore, 'analyticsEvents'), snapshot => setEvents(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))), () => setEvents([])),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd]);
  const inRange = (value: any) => { const time = asDate(value).getTime(); return time >= range.start.getTime() && time <= range.end.getTime(); };
  const paid = useMemo(() => orders.filter(order => String(order.status || order.paymentStatus) === 'paid' && inRange(order.paidAt || order.createdAt)), [orders, range]);

  const report = useMemo(() => {
    let revenue = 0;
    let fees = 0;
    let songSales = 0;
    let productSales = 0;
    const songs = new Map();
    const artists = new Map();
    const albums = new Map();
    const products = new Map();
    const countries = new Map();
    const devices = new Map();
    const sources = new Map();

    for (const order of paid) {
      const total = Number(order.amountTotal || order.total || 0);
      const fee = Number(order.stripeFee || order.feeAmount || 0);
      revenue += total;
      fees += fee;
      groupAdd(countries, countryLabel(order.country || order.customerCountry || order.shippingAddress?.country), 1, total);
      groupAdd(devices, String(order.deviceType || 'Not captured — legacy order'), 1, total);
      groupAdd(sources, String(order.trafficSource || order.utmSource || 'Not captured — legacy order'), 1, total);

      for (const song of Array.isArray(order.songs) ? order.songs : []) {
        const quantity = Number(song.quantity || 1);
        const unit = Number(song.unitAmount || 0) || (order.songs?.length ? Math.round(total / order.songs.length) : 0);
        const itemRevenue = quantity * unit;
        songSales += quantity;
        groupAdd(songs, String(song.title || song.name || song.id || 'Song'), quantity, itemRevenue);
        groupAdd(artists, String(song.artist || song.artistName || 'Unknown artist'), quantity, itemRevenue);
        groupAdd(albums, String(song.albumTitle || 'Singles / no album'), quantity, itemRevenue);
      }

      for (const product of Array.isArray(order.items) ? order.items.filter((item: any) => !item.digital) : []) {
        const quantity = Number(product.quantity || 1);
        const unit = Number(product.unitAmount || product.price || 0);
        const itemRevenue = quantity * unit;
        productSales += quantity;
        groupAdd(products, String(product.name || product.title || product.id || 'Product'), quantity, itemRevenue);
      }
    }

    const views = events.filter(event => inRange(event.createdAt) && ['page_view', 'session'].includes(String(event.type))).length;
    const checkouts = events.filter(event => inRange(event.createdAt) && String(event.type) === 'checkout_started').length;
    const conversion = views ? paid.length / views * 100 : 0;
    const newCustomers = customers.filter(customer => inRange(customer.createdAt)).length;
    const usedDownloads = downloads.filter(download => inRange(download.usedAt) && Number(download.downloadCount || 0) > 0).length;
    const sorted = (map: Map<any, any>) => [...map.values()].sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);

    return { revenue, fees, net: revenue - fees, orders: paid.length, songSales, productSales, newCustomers, downloads: usedDownloads, average: paid.length ? Math.round(revenue / paid.length) : 0, views, checkouts, conversion, songs: sorted(songs), artists: sorted(artists), albums: sorted(albums), products: sorted(products), countries: sorted(countries), devices: sorted(devices), sources: sorted(sources) };
  }, [paid, downloads, customers, events, range]);

  function reportRows(generatedAt: Date) {
    return [
      ['AUREON MUSIC GROUP ANALYTICS'],
      ['Downloaded', generatedAt.toLocaleString()],
      ['Reporting period', range.label],
      ['From', range.start.toLocaleString()],
      ['To', range.end.toLocaleString()],
      [],
      ['SUMMARY'],
      ['Revenue EUR', report.revenue / 100],
      ['Stripe fees EUR', report.fees / 100],
      ['Net revenue EUR', report.net / 100],
      ['Orders', report.orders],
      ['New customers', report.newCustomers],
      ['Downloads', report.downloads],
      ['Average order EUR', report.average / 100],
      ['Conversion rate %', Number(report.conversion.toFixed(2))],
      [],
      ['TOP SONGS'], ['Song', 'Sales', 'Revenue EUR'], ...report.songs.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['TOP ARTISTS'], ['Artist', 'Sales', 'Revenue EUR'], ...report.artists.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['TOP ALBUMS'], ['Album', 'Sales', 'Revenue EUR'], ...report.albums.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['TOP MERCHANDISE'], ['Product', 'Sales', 'Revenue EUR'], ...report.products.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['GEOGRAPHIC SALES'], ['Country', 'Orders', 'Revenue EUR'], ...report.countries.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['DEVICES'], ['Device', 'Orders', 'Revenue EUR'], ...report.devices.map((item: any) => [item.name, item.sales, item.revenue / 100]),
      [], ['TRAFFIC SOURCES'], ['Source', 'Orders', 'Revenue EUR'], ...report.sources.map((item: any) => [item.name, item.sales, item.revenue / 100]),
    ];
  }

  function exportExcel() {
    const generatedAt = new Date();
    const data = reportRows(generatedAt);
    const tableRows = data.map(row => `<tr>${row.map(value => `<td class="${row.length === 1 ? 'section' : ''}">${htmlEscape(value)}</td>`).join('')}</tr>`).join('');
    const html = `<html><head><meta charset="UTF-8"><style>body{font-family:Arial;color:#222}.brand{background:#080808;color:#c7a64a;padding:22px;font-size:24px;font-weight:bold}.meta{color:#666;margin:8px 0 18px}table{border-collapse:collapse;width:100%}td{border:1px solid #d9ca9a;padding:8px}.section{background:#111;color:#c7a64a;font-weight:bold;font-size:15px}tr:nth-child(even){background:#faf8f0}</style></head><body><div class="brand"><img src="https://www.aureonmusicgroup.com/images/branding/Aureon_Header_Logo.png" height="58" alt="Aureon Music Group"><br>AUREON MUSIC GROUP — BUSINESS ANALYTICS</div><div class="meta">Downloaded: ${htmlEscape(generatedAt.toLocaleString())} | Period: ${htmlEscape(range.label)}</div><table>${tableRows}</table></body></html>`;
    downloadBlob(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `Aureon-Analytics-${generatedAt.toISOString().replace(/[:.]/g, '-')}.xls`);
  }

  function exportCsv() {
    const generatedAt = new Date();
    const csv = reportRows(generatedAt).map(row => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `Aureon-Analytics-${generatedAt.toISOString().replace(/[:.]/g, '-')}.csv`);
  }

  const table = (title: string, data: any[], label: string) => (
    <article><h2>{title}</h2><div className="admin-table-wrap"><table><thead><tr><th>{label}</th><th>Sales / Orders</th><th>Revenue</th></tr></thead><tbody>{data.length ? data.slice(0, 20).map((item: any) => <tr key={item.name}><td>{item.name}</td><td>{item.sales}</td><td>{money(item.revenue)}</td></tr>) : <tr><td colSpan={3}>No data for this period.</td></tr>}</tbody></table></div></article>
  );

  return (
    <AdminShell>
      <div className="admin-page-heading"><p className="admin-kicker">Business intelligence</p><h1>Analytics</h1><p>Track sales, customers, catalogue performance, geography, devices and traffic sources. Country, device and source tracking applies to new purchases after this update.</p></div>
      {error && <div className="admin-cms-message">{error}</div>}
      <div className="admin-toolbar">
        <label>Period <select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="lastMonth">Last month</option><option value="quarter">Quarter</option><option value="year">Year</option><option value="custom">Custom range</option></select></label>
        {period === 'custom' && <><label>From <input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label><label>To <input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label></>}
        <button className="primary-button" onClick={exportExcel}><FileSpreadsheet size={16} /> Excel</button>
        <button onClick={exportCsv}><Download size={16} /> CSV</button>
        <button onClick={() => window.print()}><Printer size={16} /> Print</button>
      </div>
      <section className="admin-stat-grid">{[['Revenue', money(report.revenue)], ['Stripe fees', money(report.fees)], ['Net revenue', money(report.net)], ['Orders', report.orders], ['Customers', report.newCustomers], ['Downloads', report.downloads], ['Average order', money(report.average)], ['Conversion', `${report.conversion.toFixed(2)}%`]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="admin-dashboard-grid">{table('Best-selling songs', report.songs, 'Song')}{table('Best-selling artists', report.artists, 'Artist')}{table('Revenue by album', report.albums, 'Album')}{table('Top merchandise', report.products, 'Product')}{table('Geographic sales', report.countries, 'Country')}{table('Device types', report.devices, 'Device')}{table('Traffic sources', report.sources, 'Source')}</section>
    </AdminShell>
  );
}
