'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { exportExecutiveWorkbook } from '@/lib/export-executive-workbook';

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';
type Row = Record<string, any>;
type Range = { start: Date; end: Date; label: string };

const asDate = (value: any) => value?.toDate?.() || new Date(value || 0);
const money = (cents: number) => `€${(Number(cents || 0) / 100).toFixed(2)}`;
const dayStart = (date: Date) => { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; };
const dayEnd = (date: Date) => { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; };
const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const countryNames: Record<string, string> = { IE: 'Ireland', GB: 'United Kingdom', US: 'United States', PT: 'Portugal', ES: 'Spain', FR: 'France', DE: 'Germany', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', BR: 'Brazil', ZA: 'South Africa', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', MX: 'Mexico', AE: 'United Arab Emirates', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland', GR: 'Greece', JP: 'Japan', IN: 'India' };
function countryLabel(value: unknown) { const code = String(value || '').trim().toUpperCase(); if (!code || code === 'UNKNOWN' || code === 'NOT CAPTURED') return 'Not captured — legacy order'; return countryNames[code] || code; }

function rangeFor(period: Period, customStart: string, customEnd: string): Range {
  const now = new Date(); let start = dayStart(now); let end = dayEnd(now); let label = 'Today';
  if (period === 'yesterday') { const date = new Date(now); date.setDate(date.getDate() - 1); start = dayStart(date); end = dayEnd(date); label = 'Yesterday'; }
  if (period === '7d') { start = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)); label = 'Last 7 days'; }
  if (period === '30d') { start = dayStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)); label = 'Last 30 days'; }
  if (period === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); label = 'This month'; }
  if (period === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = dayEnd(new Date(now.getFullYear(), now.getMonth(), 0)); label = 'Last month'; }
  if (period === 'quarter') { start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); label = 'This quarter'; }
  if (period === 'year') { start = new Date(now.getFullYear(), 0, 1); label = 'This year'; }
  if (period === 'custom') { start = customStart ? dayStart(new Date(`${customStart}T00:00:00`)) : dayStart(now); end = customEnd ? dayEnd(new Date(`${customEnd}T00:00:00`)) : dayEnd(now); label = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`; }
  return { start, end, label };
}

type Metric = { name: string; plays: number; completes: number; previewCompletes: number; cartAdds: number; views: number; sales: number; revenue: number; listenedSeconds: number; countries: Map<string, number>; artistName?: string; albumTitle?: string };
function bump(map: Map<string, Metric>, key: string, field: keyof Metric, amount = 1, country = '', extra: Partial<Metric> = {}) {
  const name = key || 'Not captured';
  const item = map.get(name) || { name, plays: 0, completes: 0, previewCompletes: 0, cartAdds: 0, views: 0, sales: 0, revenue: 0, listenedSeconds: 0, countries: new Map<string, number>() };
  Object.assign(item, Object.fromEntries(Object.entries(extra).filter(([, value]) => value)));
  if (typeof item[field] === 'number') (item[field] as number) += amount;
  if (country) item.countries.set(country, (item.countries.get(country) || 0) + amount);
  map.set(name, item);
}
function finish(map: Map<string, Metric>) { return [...map.values()].map(item => ({ ...item, completionRate: item.plays ? Math.round(item.completes / item.plays * 100) : 0, cartRate: item.views ? Math.round(item.cartAdds / item.views * 100) : 0, avgListen: item.plays ? Math.round(item.listenedSeconds / item.plays) : 0, topCountries: [...item.countries.entries()].sort((a, b) => b[1] - a[1]) })).sort((a, b) => (b.revenue + b.sales + b.plays + b.views) - (a.revenue + a.sales + a.plays + a.views)); }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click(); window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1500); }

export default function AnalyticsPage() {
  const { authorised, loading } = useAdminAuth();
  const [period, setPeriod] = useState<Period>('month'); const [customStart, setCustomStart] = useState(''); const [customEnd, setCustomEnd] = useState('');
  const [orders, setOrders] = useState<Row[]>([]); const [downloads, setDownloads] = useState<Row[]>([]); const [customers, setCustomers] = useState<Row[]>([]); const [events, setEvents] = useState<Row[]>([]); const [members, setMembers] = useState<Row[]>([]); const [error, setError] = useState(''); const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (loading || !authorised) return;
    const rows = (snapshot: any) => snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() }));
    const fail = (snapshotError: unknown) => { console.error(snapshotError); setError('Unable to read analytics. Confirm administrator permissions.'); };
    const unsubscribers = [
      onSnapshot(collection(firestore, 'orders'), snapshot => setOrders(rows(snapshot)), fail),
      onSnapshot(collection(firestore, 'downloads'), snapshot => setDownloads(rows(snapshot)), fail),
      onSnapshot(collection(firestore, 'customers'), snapshot => setCustomers(rows(snapshot)), fail),
      onSnapshot(collection(firestore, 'analyticsEvents'), snapshot => setEvents(rows(snapshot)), () => setEvents([])),
      onSnapshot(collection(firestore, 'members'), snapshot => setMembers(rows(snapshot)), () => setMembers([])),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd]);
  const inRange = (value: any) => { const time = asDate(value).getTime(); return time >= range.start.getTime() && time <= range.end.getTime(); };
  const paid = useMemo(() => orders.filter(order => String(order.status || order.paymentStatus).toLowerCase() === 'paid' && inRange(order.paidAt || order.createdAt)), [orders, range]);

  const report = useMemo(() => {
    const songMap = new Map<string, Metric>(), artistMap = new Map<string, Metric>(), albumMap = new Map<string, Metric>(), productMap = new Map<string, Metric>(), countryMap = new Map<string, Metric>(), regionMap = new Map<string, Metric>(), cityMap = new Map<string, Metric>(), deviceMap = new Map<string, Metric>(), referrerMap = new Map<string, Metric>();
    let gross = 0, fees = 0;
    const filteredEvents = events.filter(event => inRange(event.createdAt || event.receivedAt));
    for (const event of filteredEvents) {
      const country = countryLabel(event.country), type = String(event.eventType || event.type || 'page_view');
      const field: keyof Metric = type === 'song_play' ? 'plays' : type === 'song_complete' ? 'completes' : type === 'preview_complete' ? 'previewCompletes' : type.includes('cart_add') ? 'cartAdds' : 'views';
      const song = String(event.title || event.entityId || 'Not captured'); const artist = String(event.artistName || event.artistId || 'Unknown artist'); const album = String(event.albumTitle || 'Singles / no album');
      if (event.entityType === 'song' || type.startsWith('song_') || type === 'preview_complete') {
        bump(songMap, song, field, 1, country, { artistName: artist, albumTitle: album }); bump(songMap, song, 'listenedSeconds', Number(event.listenedSeconds || 0)); bump(artistMap, artist, field, 1, country); bump(albumMap, album, field, 1, country);
      }
      if (event.entityType === 'product' || type.startsWith('merch_')) bump(productMap, String(event.productName || event.title || event.productId || 'Product'), field, 1, country);
      bump(countryMap, country, field, 1, country); bump(regionMap, `${country} · ${event.region || 'Unknown'}`, field, 1, country); bump(cityMap, `${event.city || 'Unknown'}, ${country}`, field, 1, country); bump(deviceMap, String(event.deviceType || 'Unknown'), field, 1, country); if (event.referrer) bump(referrerMap, String(event.referrer), field, 1, country);
    }
    for (const order of paid) {
      const total = Number(order.amountTotal || order.total || 0), fee = Number(order.stripeFee || order.feeAmount || 0), country = countryLabel(order.country || order.customerCountry || order.shippingAddress?.country); gross += total; fees += fee;
      bump(countryMap, country, 'sales', 1, country); bump(countryMap, country, 'revenue', total); bump(deviceMap, String(order.deviceType || 'Not captured'), 'sales', 1, country); bump(referrerMap, String(order.trafficSource || order.utmSource || 'Not captured'), 'sales', 1, country);
      for (const song of Array.isArray(order.songs) ? order.songs : []) { const quantity = Number(song.quantity || 1), itemRevenue = Number(song.unitAmount || 0) * quantity || Math.round(total / Math.max(1, order.songs.length)), title = String(song.title || song.name || song.id || 'Song'), artist = String(song.artist || song.artistName || 'Unknown artist'), album = String(song.albumTitle || 'Singles / no album'); bump(songMap, title, 'sales', quantity, country, { artistName: artist, albumTitle: album }); bump(songMap, title, 'revenue', itemRevenue); bump(artistMap, artist, 'sales', quantity, country); bump(artistMap, artist, 'revenue', itemRevenue); bump(albumMap, album, 'sales', quantity, country); bump(albumMap, album, 'revenue', itemRevenue); }
      for (const product of Array.isArray(order.items) ? order.items.filter((item: any) => !item.digital) : []) { const quantity = Number(product.quantity || 1), itemRevenue = Number(product.unitAmount || product.price || 0) * quantity, name = String(product.name || product.title || product.id || 'Product'); bump(productMap, name, 'sales', quantity, country); bump(productMap, name, 'revenue', itemRevenue); }
    }
    const active = members.filter(member => ['active', 'trialing'].includes(String(member.subscriptionStatus).toLowerCase())).length;
    return { gross, fees, net: gross - fees, orders: paid.length, active, eventCount: filteredEvents.length, songs: finish(songMap), artists: finish(artistMap), albums: finish(albumMap), products: finish(productMap), countries: finish(countryMap), regions: finish(regionMap), cities: finish(cityMap), devices: finish(deviceMap), referrers: finish(referrerMap), newCustomers: customers.filter(customer => inRange(customer.createdAt)).length, downloads: downloads.filter(download => inRange(download.usedAt) && Number(download.downloadCount || 0) > 0).length };
  }, [paid, events, members, customers, downloads, range]);

  async function exportExcel() { setExporting(true); setError(''); try { await exportExecutiveWorkbook({ report, orders, members, events, start: range.start, end: range.end }); } catch (exportError) { console.error(exportError); setError(exportError instanceof Error ? exportError.message : 'Unable to generate the Excel board pack.'); } finally { setExporting(false); } }
  function exportCsv() { const rows: unknown[][] = [['AUREON MUSIC GROUP ANALYTICS'], ['Reporting period', range.label], ['Gross revenue EUR', report.gross / 100], ['Net revenue EUR', report.net / 100], ['Orders', report.orders], ['Active subscriptions', report.active], ['Song plays', report.songs.reduce((sum: number, item: any) => sum + item.plays, 0)], [], ['SONGS'], ['Song', 'Artist', 'Album', 'Plays', 'Completed', 'Sales', 'Revenue EUR'], ...report.songs.map((item: any) => [item.name, item.artistName, item.albumTitle, item.plays, item.completes, item.sales, item.revenue / 100])]; downloadBlob(new Blob(['\ufeff', rows.map(row => row.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), `Aureon-Analytics-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`); }
  const table = (title: string, data: any[], label: string) => <article><h2>{title}</h2><div className="admin-table-wrap"><table><thead><tr><th>{label}</th><th>Plays / Views</th><th>Sales</th><th>Revenue</th></tr></thead><tbody>{data.length ? data.slice(0, 20).map((item: any) => <tr key={item.name}><td>{item.name}</td><td>{item.plays || item.views || 0}</td><td>{item.sales}</td><td>{money(item.revenue)}</td></tr>) : <tr><td colSpan={4}>No data for this period.</td></tr>}</tbody></table></div></article>;

  return <AdminShell><div className="admin-page-heading"><p className="admin-kicker">Business intelligence</p><h1>Analytics</h1><p>Track sales, listening, customers, catalogue performance, merchandise, geography, devices and traffic sources.</p></div>{error && <div className="admin-cms-message">{error}</div>}<div className="admin-toolbar"><label>Period <select value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="month">This month</option><option value="lastMonth">Last month</option><option value="quarter">Quarter</option><option value="year">Year</option><option value="custom">Custom range</option></select></label>{period === 'custom' && <><label>From <input type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} /></label><label>To <input type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} /></label></>}<button className="primary-button" disabled={exporting} onClick={() => void exportExcel()}><FileSpreadsheet size={16} /> {exporting ? 'Building board pack…' : 'Executive Excel Board Pack'}</button><button onClick={exportCsv}><Download size={16} /> CSV</button><button onClick={() => window.print()}><Printer size={16} /> Print</button></div><section className="admin-stat-grid">{[['Gross revenue', money(report.gross)], ['Stripe fees', money(report.fees)], ['Net revenue', money(report.net)], ['Orders', report.orders], ['Customers', report.newCustomers], ['Downloads', report.downloads], ['Active subscriptions', report.active], ['Tracked events', report.eventCount]].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</section><section className="admin-dashboard-grid">{table('Song performance', report.songs, 'Song')}{table('Artist performance', report.artists, 'Artist')}{table('Album performance', report.albums, 'Album')}{table('Merchandise performance', report.products, 'Product')}{table('Geographic performance', report.countries, 'Country')}{table('Device types', report.devices, 'Device')}{table('Traffic sources', report.referrers, 'Source')}</section></AdminShell>;
}
