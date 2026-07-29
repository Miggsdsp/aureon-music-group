'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { FileText, RefreshCw, Search } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { firestore } from '@/lib/firebase-client';

type Row = { id: string; [key: string]: any };
type Tab = 'subscriptions' | 'downloads' | 'licences' | 'refunds';
const dateOf = (value: any) => value?.toDate?.() || (value ? new Date(value) : null);
const dateLabel = (value: any) => { const date = dateOf(value); return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-IE') : '—'; };
const money = (value: any, currency = 'EUR') => new Intl.NumberFormat('en-IE', { style: 'currency', currency: String(currency || 'EUR').toUpperCase() }).format(Number(value || 0) / 100);
const mapRows = (snapshot: any): Row[] => snapshot.docs.map((item: any) => ({ id: item.id, ...item.data() }));

export default function CommerceOperationsPage() {
  const { authorised, loading, user } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('subscriptions');
  const [members, setMembers] = useState<Row[]>([]);
  const [downloads, setDownloads] = useState<Row[]>([]);
  const [licences, setLicences] = useState<Row[]>([]);
  const [refunds, setRefunds] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Row | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    const fail = (error: unknown) => { console.error(error); setMessage('One or more secure operational collections could not be loaded.'); };
    const unsubscribers = [
      onSnapshot(collection(firestore, 'members'), snapshot => setMembers(mapRows(snapshot)), fail),
      onSnapshot(collection(firestore, 'downloads'), snapshot => setDownloads(mapRows(snapshot)), fail),
      onSnapshot(collection(firestore, 'commercialLicences'), snapshot => setLicences(mapRows(snapshot)), () => setLicences([])),
      onSnapshot(collection(firestore, 'refunds'), snapshot => setRefunds(mapRows(snapshot)), () => setRefunds([])),
      onSnapshot(collection(firestore, 'orders'), snapshot => setOrders(mapRows(snapshot)), fail),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const q = query.trim().toLowerCase();
  const source = tab === 'subscriptions' ? members : tab === 'downloads' ? downloads : tab === 'licences' ? licences : refunds;
  const filtered = useMemo(() => source.filter(item => {
    const state = String(item.subscriptionStatus || item.status || item.paymentStatus || '').toLowerCase();
    const haystack = JSON.stringify(item).toLowerCase();
    return (status === 'all' || state === status) && (!q || haystack.includes(q));
  }).sort((a, b) => Number(dateOf(b.updatedAt || b.createdAt)?.getTime() || 0) - Number(dateOf(a.updatedAt || a.createdAt)?.getTime() || 0)), [source, q, status]);

  async function resendInvoice(orderId: string) {
    if (!user || !orderId || !confirm('Resend this invoice to the customer email on the order?')) return;
    setBusy(orderId); setMessage('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/resend-invoice`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to resend invoice.');
      setMessage('Invoice resent successfully.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to resend invoice.'); }
    finally { setBusy(''); }
  }

  async function addCustomerNote(member: Row) {
    const note = prompt('Add an internal customer note:', String(member.notes || ''));
    if (note === null) return;
    await updateDoc(doc(firestore, 'members', member.id), { notes: note, updatedAt: new Date() });
    setMessage('Customer note saved.');
  }

  const counts = {
    subscriptions: members.length,
    downloads: downloads.length,
    licences: licences.length,
    refunds: refunds.length,
  };

  const statusOptions = tab === 'subscriptions'
    ? ['active', 'trialing', 'past_due', 'cancelled', 'inactive']
    : tab === 'downloads' ? ['active', 'used', 'expired', 'superseded']
    : tab === 'licences' ? ['active', 'expired', 'revoked']
    : ['pending', 'succeeded', 'failed'];

  function relatedOrders(item: Row) {
    const email = String(item.email || item.customerEmail || '').toLowerCase();
    return orders.filter(order => order.id === item.orderId || (email && String(order.customerEmail || '').toLowerCase() === email));
  }

  return <AdminShell>
    <div className="admin-page-heading"><p className="admin-kicker">Commerce and CRM</p><h1>Subscriptions, Downloads, Licences & Refunds</h1><p>Live operational records connected to Stripe, members, orders and secure delivery history.</p></div>
    {message && <div className="admin-cms-message" role="status">{message}</div>}
    <div className="admin-toolbar">
      <div>{(['subscriptions','downloads','licences','refunds'] as Tab[]).map(item => <button key={item} onClick={() => { setTab(item); setSelected(null); setStatus('all'); }}>{item[0].toUpperCase() + item.slice(1)} ({counts[item]})</button>)}</div>
      <label style={{ display:'flex',alignItems:'center',gap:8 }}><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} /></label>
      <label>Status <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All</option>{statusOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>

    <div className="admin-table-wrap"><table><thead><tr>
      <th>Date</th><th>{tab === 'subscriptions' ? 'Member' : tab === 'downloads' ? 'Download' : tab === 'licences' ? 'Licence' : 'Refund'}</th><th>Customer</th><th>Status</th><th>Details</th><th>Actions</th>
    </tr></thead><tbody>{filtered.length ? filtered.map(item => {
      const orderId = String(item.orderId || item.stripeCheckoutSessionId || '');
      return <tr key={item.id}>
        <td>{dateLabel(item.updatedAt || item.createdAt || item.usedAt)}</td>
        <td><strong>{item.licenceId || item.orderNumber || item.songTitle || item.plan || item.id}</strong></td>
        <td>{item.name || item.customerName || '—'}<br/><small>{item.email || item.customerEmail || '—'}</small></td>
        <td>{item.subscriptionStatus || item.status || item.paymentStatus || '—'}</td>
        <td>{tab === 'subscriptions' ? `${item.plan || 'No plan'} · renews ${dateLabel(item.currentPeriodEnd)}` : tab === 'downloads' ? `${item.songTitle || item.songId || 'Track'} · ${item.downloadCount || 0}/${item.maxDownloads || 1}` : tab === 'licences' ? `${item.songTitle || item.songId || 'Track'} · ${item.usageType || item.projectName || 'Commercial use'}` : `${money(item.amount || item.amountRefunded, item.currency)} · ${item.reason || 'No reason recorded'}`}</td>
        <td><button onClick={() => setSelected(item)}>Open</button>{tab === 'subscriptions' && <button onClick={() => addCustomerNote(item)}>Notes</button>}{orderId && <button disabled={busy === orderId} onClick={() => resendInvoice(orderId)}><FileText size={14}/> Invoice</button>}</td>
      </tr>;
    }) : <tr><td colSpan={6}>No matching records.</td></tr>}</tbody></table></div>

    {selected && <section className="admin-dashboard-grid"><article style={{gridColumn:'1 / -1'}}><h2>Operational record</h2><p><strong>{selected.licenceId || selected.orderNumber || selected.songTitle || selected.plan || selected.id}</strong></p>
      <div className="admin-table-wrap"><table><tbody>{Object.entries(selected).filter(([key]) => !['id','privateFilePath','token'].includes(key)).slice(0,40).map(([key,value]) => <tr key={key}><th>{key}</th><td>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</td></tr>)}</tbody></table></div>
      <h3>Related purchase history</h3><div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Total</th><th>Status</th></tr></thead><tbody>{relatedOrders(selected).length ? relatedOrders(selected).map(order => <tr key={order.id}><td>{dateLabel(order.paidAt || order.createdAt)}</td><td>{order.orderNumber || order.id}</td><td>{money(order.amountTotal, order.currency)}</td><td>{order.status || order.paymentStatus}</td></tr>) : <tr><td colSpan={4}>No linked orders.</td></tr>}</tbody></table></div>
      <button onClick={() => setSelected(null)}>Close</button>
    </article></section>}
  </AdminShell>;
}
