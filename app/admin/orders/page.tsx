'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Download, RefreshCw, Search } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Row = { id: string; [key: string]: any };
type Tab = 'orders' | 'customers' | 'enquiries';

const dateValue = (value: any) => (value?.toDate?.() || new Date(value || 0)).getTime() || 0;
const displayDate = (value: any) => {
  const timestamp = dateValue(value);
  return timestamp ? new Date(timestamp).toLocaleString() : '—';
};
const money = (value: any) => `€${(Number(value || 0) / 100).toFixed(2)}`;

export default function OrdersPage() {
  const { authorised, loading, user } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('orders');
  const [orders, setOrders] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [enquiries, setEnquiries] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Row | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Row | null>(null);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    const fail = (value: unknown) => {
      console.error(value);
      setError('Unable to read secure commerce data. Confirm administrator permissions.');
    };
    const unsubscribers = [
      onSnapshot(collection(firestore, 'orders'), snapshot => setOrders(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })).sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))), fail),
      onSnapshot(collection(firestore, 'customers'), snapshot => setCustomers(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })).sort((a, b) => dateValue(b.lastOrderAt || b.updatedAt) - dateValue(a.lastOrderAt || a.updatedAt))), fail),
      onSnapshot(collection(firestore, 'enquiries'), snapshot => setEnquiries(snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() })).sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt))), fail)
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [authorised, loading]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOrders = useMemo(() => orders.filter(order => {
    const matchesStatus = statusFilter === 'all' || String(order.paymentStatus || order.status || '').toLowerCase() === statusFilter;
    const haystack = [order.orderNumber, order.id, order.customerName, order.customerEmail, ...(order.songs || []).map((song: any) => song.title)].join(' ').toLowerCase();
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  }), [orders, normalizedQuery, statusFilter]);

  const filteredCustomers = useMemo(() => customers.filter(customer => {
    const haystack = [customer.name, customer.email, customer.phone, customer.stripeCustomerId].join(' ').toLowerCase();
    return !normalizedQuery || haystack.includes(normalizedQuery);
  }), [customers, normalizedQuery]);

  const filteredEnquiries = useMemo(() => enquiries.filter(enquiry => {
    const matchesStatus = statusFilter === 'all' || String(enquiry.status || 'new') === statusFilter;
    const haystack = [enquiry.name, enquiry.email, enquiry.department, enquiry.subject, enquiry.message].join(' ').toLowerCase();
    return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  }), [enquiries, normalizedQuery, statusFilter]);

  const customerOrders = useMemo(() => selectedCustomer ? orders.filter(order => String(order.customerEmail || '').toLowerCase() === String(selectedCustomer.email || selectedCustomer.id).toLowerCase()) : [], [orders, selectedCustomer]);
  const customerSpend = customerOrders.filter(order => String(order.status) === 'paid').reduce((sum, order) => sum + Number(order.amountTotal || 0), 0);

  async function setEnquiryStatus(id: string, status: string) {
    await updateDoc(doc(firestore, 'enquiries', id), { status, updatedAt: new Date() });
  }

  async function regenerateDownload(order: Row) {
    if (!user) return;
    if (!window.confirm(`Create a new one-time download link and email it to ${order.customerEmail}?`)) return;
    setActionId(order.id);
    setMessage('');
    setError('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/regenerate-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to regenerate the download.');
      setMessage(`A new one-time download email was sent to ${order.customerEmail}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to regenerate the download.');
    } finally {
      setActionId('');
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedOrder(null);
    setSelectedCustomer(null);
    setStatusFilter('all');
    setQuery('');
    setMessage('');
  }

  return <AdminShell>
    <div className="admin-page-heading"><p className="admin-kicker">Commerce operations</p><h1>Orders & Customers</h1><p>Search payments, inspect customer history and regenerate secure downloads.</p></div>
    {error && <div className="admin-cms-message" role="alert">{error}</div>}
    {message && <div className="admin-cms-message" role="status">{message}</div>}

    <div className="admin-toolbar">
      <div><button type="button" onClick={() => switchTab('orders')}>Orders ({orders.length})</button><button type="button" onClick={() => switchTab('customers')}>Customers ({customers.length})</button><button type="button" onClick={() => switchTab('enquiries')}>Enquiries ({enquiries.length})</button></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} /></label>
      {tab !== 'customers' && <label>Status <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All</option>{tab === 'orders' ? <><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="expired">Expired</option></> : <><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option><option value="archived">Archived</option><option value="spam">Spam</option></>}</select></label>}
    </div>

    <div className="admin-table-wrap"><table><thead>{tab === 'orders' ? <tr><th>Date</th><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Download</th><th>Actions</th></tr> : tab === 'customers' ? <tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Lifetime spend</th><th>Last order</th><th>Actions</th></tr> : <tr><th>Date</th><th>Name</th><th>Department</th><th>Subject</th><th>Email</th><th>Status</th></tr>}</thead>
      <tbody>{tab === 'orders' ? (filteredOrders.length ? filteredOrders.map(order => <tr key={order.id}><td>{displayDate(order.paidAt || order.createdAt)}</td><td><button type="button" onClick={() => setSelectedOrder(order)}>{order.orderNumber || order.id}</button></td><td>{order.customerName || '—'}<br/><small>{order.customerEmail}</small></td><td>{(order.songs || order.items || []).map((item: any) => item.title || item.name).join(', ') || '—'}</td><td>{money(order.amountTotal || order.total)}</td><td>{order.paymentStatus || order.status}</td><td>{order.downloadStatus || '—'}</td><td><button type="button" disabled={actionId === order.id || order.status !== 'paid'} onClick={() => regenerateDownload(order)}><RefreshCw size={15}/> {actionId === order.id ? 'Sending…' : 'Regenerate'}</button></td></tr>) : <tr><td colSpan={8}>No matching orders.</td></tr>) : tab === 'customers' ? (filteredCustomers.length ? filteredCustomers.map(customer => {
        const related = orders.filter(order => String(order.customerEmail || '').toLowerCase() === String(customer.email || customer.id).toLowerCase());
        const spend = related.filter(order => order.status === 'paid').reduce((sum, order) => sum + Number(order.amountTotal || 0), 0);
        return <tr key={customer.id}><td>{customer.name || '—'}</td><td>{customer.email || customer.id}</td><td>{customer.phone || '—'}</td><td>{customer.totalOrders ?? related.length}</td><td>{money(customer.lifetimeSpend ?? spend)}</td><td>{displayDate(customer.lastOrderAt || customer.updatedAt || customer.createdAt)}</td><td><button type="button" onClick={() => setSelectedCustomer(customer)}>View history</button></td></tr>;
      }) : <tr><td colSpan={7}>No matching customers.</td></tr>) : (filteredEnquiries.length ? filteredEnquiries.map(enquiry => <tr key={enquiry.id}><td>{displayDate(enquiry.createdAt)}</td><td>{enquiry.name}</td><td>{enquiry.department}</td><td><strong>{enquiry.subject}</strong><br/><small>{enquiry.message}</small></td><td><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></td><td><select value={enquiry.status || 'new'} onChange={event => setEnquiryStatus(enquiry.id, event.target.value)}><option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option><option value="archived">Archived</option><option value="spam">Spam</option></select></td></tr>) : <tr><td colSpan={6}>No matching enquiries.</td></tr>)}</tbody>
    </table></div>

    {selectedOrder && <section className="admin-dashboard-grid"><article style={{ gridColumn: '1 / -1' }}><h2>Order details</h2><p><strong>{selectedOrder.orderNumber || selectedOrder.id}</strong> · {displayDate(selectedOrder.paidAt || selectedOrder.createdAt)}</p><p>{selectedOrder.customerName} · {selectedOrder.customerEmail}</p><p>Stripe payment: {selectedOrder.stripePaymentIntentId || '—'}</p><p>Email: {selectedOrder.emailStatus || '—'} · Download: {selectedOrder.downloadStatus || '—'}</p><div className="admin-table-wrap"><table><thead><tr><th>Song</th><th>Artist</th><th>Price</th></tr></thead><tbody>{(selectedOrder.songs || []).map((song: any, index: number) => <tr key={song.id || index}><td>{song.title}</td><td>{song.artist}</td><td>{money(song.unitAmount || 0)}</td></tr>)}</tbody></table></div><button type="button" onClick={() => setSelectedOrder(null)}>Close</button></article></section>}

    {selectedCustomer && <section className="admin-dashboard-grid"><article style={{ gridColumn: '1 / -1' }}><h2>Customer history</h2><p><strong>{selectedCustomer.name || selectedCustomer.email}</strong> · {selectedCustomer.email || selectedCustomer.id}</p><p>{customerOrders.length} orders · {money(selectedCustomer.lifetimeSpend ?? customerSpend)} lifetime spend</p><div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>{customerOrders.length ? customerOrders.map(order => <tr key={order.id}><td>{displayDate(order.paidAt || order.createdAt)}</td><td>{order.orderNumber || order.id}</td><td>{(order.songs || []).map((song: any) => song.title).join(', ')}</td><td>{money(order.amountTotal)}</td><td>{order.status}</td></tr>) : <tr><td colSpan={5}>No orders found.</td></tr>}</tbody></table></div><button type="button" onClick={() => setSelectedCustomer(null)}>Close</button></article></section>}
  </AdminShell>;
}
