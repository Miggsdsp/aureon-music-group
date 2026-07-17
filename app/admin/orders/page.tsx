'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { RefreshCw, Save, Search, Send } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Row = { id: string; [key: string]: any };
type Tab = 'orders' | 'customers' | 'enquiries';

const dateValue = (value: any) =>
  (value?.toDate?.() || new Date(value || 0)).getTime() || 0;

const displayDate = (value: any) => {
  const time = dateValue(value);
  return time ? new Date(time).toLocaleString() : '—';
};

const money = (value: any) => `€${(Number(value || 0) / 100).toFixed(2)}`;

const snapshotRows = (docs: Array<{ id: string; data: () => any }>): Row[] =>
  docs.map<Row>(item => ({ id: item.id, ...(item.data() as Record<string, any>) }));

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
  const [selectedEnquiry, setSelectedEnquiry] = useState<Row | null>(null);
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState('');
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;

    const fail = (snapshotError: unknown) => {
      console.error(snapshotError);
      setError('Unable to read secure commerce data.');
    };

    const unsubscribeOrders = onSnapshot(
      collection(firestore, 'orders'),
      snapshot => {
        const rows = snapshotRows(snapshot.docs).sort(
          (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt),
        );
        setOrders(rows);
      },
      fail,
    );

    const unsubscribeCustomers = onSnapshot(
      collection(firestore, 'customers'),
      snapshot => {
        const rows = snapshotRows(snapshot.docs).sort(
          (a, b) =>
            dateValue(b.lastOrderAt || b.updatedAt) -
            dateValue(a.lastOrderAt || a.updatedAt),
        );
        setCustomers(rows);
      },
      fail,
    );

    const unsubscribeEnquiries = onSnapshot(
      collection(firestore, 'enquiries'),
      snapshot => {
        const rows = snapshotRows(snapshot.docs).sort(
          (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt),
        );
        setEnquiries(rows);
      },
      fail,
    );

    return () => {
      unsubscribeOrders();
      unsubscribeCustomers();
      unsubscribeEnquiries();
    };
  }, [authorised, loading]);

  const q = query.trim().toLowerCase();

  const filteredOrders = useMemo(
    () =>
      orders.filter(order => {
        const status = String(order.paymentStatus || order.status || '').toLowerCase();
        const statusMatches = statusFilter === 'all' || status === statusFilter;
        const searchText = [
          order.orderNumber,
          order.id,
          order.customerName,
          order.customerEmail,
          ...(order.songs || []).map((song: any) => song.title),
        ]
          .join(' ')
          .toLowerCase();
        return statusMatches && (!q || searchText.includes(q));
      }),
    [orders, q, statusFilter],
  );

  const filteredCustomers = useMemo(
    () =>
      customers.filter(customer =>
        !q
          ? true
          : [
              customer.name,
              customer.email,
              customer.phone,
              customer.stripeCustomerId,
              customer.notes,
            ]
              .join(' ')
              .toLowerCase()
              .includes(q),
      ),
    [customers, q],
  );

  const filteredEnquiries = useMemo(
    () =>
      enquiries.filter(enquiry => {
        const statusMatches =
          statusFilter === 'all' || String(enquiry.status || 'new') === statusFilter;
        const searchText = [
          enquiry.name,
          enquiry.email,
          enquiry.department,
          enquiry.subject,
          enquiry.message,
        ]
          .join(' ')
          .toLowerCase();
        return statusMatches && (!q || searchText.includes(q));
      }),
    [enquiries, q, statusFilter],
  );

  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const email = String(selectedCustomer.email || '').toLowerCase();
    return orders.filter(order => String(order.customerEmail || '').toLowerCase() === email);
  }, [orders, selectedCustomer]);

  const customerDownloads = useMemo(
    () => customerOrders.flatMap(order => order.songs || []),
    [customerOrders],
  );

  async function setEnquiryStatus(id: string, status: string) {
    await updateDoc(doc(firestore, 'enquiries', id), {
      status,
      updatedAt: new Date(),
    });
  }

  async function regenerateDownload(order: Row) {
    if (!user || !confirm(`Email new one-time download links to ${order.customerEmail}?`)) return;
    setActionId(order.id);
    setError('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(
        `/api/admin/orders/${encodeURIComponent(order.id)}/regenerate-download`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to regenerate download.');
      setMessage(`New download email sent to ${order.customerEmail}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to regenerate download.');
    } finally {
      setActionId('');
    }
  }

  async function sendReply() {
    if (!user || !selectedEnquiry || !reply.trim()) return;
    setActionId(selectedEnquiry.id);
    setError('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/admin/enquiries/${selectedEnquiry.id}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: reply.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send reply.');
      setMessage(`Reply sent to ${selectedEnquiry.email}.`);
      setReply('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reply.');
    } finally {
      setActionId('');
    }
  }

  async function saveNotes() {
    if (!selectedCustomer) return;
    await updateDoc(doc(firestore, 'customers', selectedCustomer.id), {
      notes,
      updatedAt: new Date(),
    });
    setMessage('Customer notes saved.');
  }

  function switchTab(nextTab: Tab) {
    setTab(nextTab);
    setSelectedOrder(null);
    setSelectedCustomer(null);
    setSelectedEnquiry(null);
    setStatusFilter('all');
    setQuery('');
  }

  return (
    <AdminShell>
      <div className="admin-page-heading">
        <p className="admin-kicker">Commerce operations</p>
        <h1>Orders, Customers & Enquiries</h1>
        <p>Manage payments, purchase history, downloads, customer notes and enquiry replies.</p>
      </div>

      {error && <div className="admin-cms-message" role="alert">{error}</div>}
      {message && <div className="admin-cms-message">{message}</div>}

      <div className="admin-toolbar">
        <div>
          <button onClick={() => switchTab('orders')}>Orders ({orders.length})</button>
          <button onClick={() => switchTab('customers')}>Customers ({customers.length})</button>
          <button onClick={() => switchTab('enquiries')}>Enquiries ({enquiries.length})</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={16} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} />
        </label>
        {tab !== 'customers' && (
          <label>
            Status{' '}
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {tab === 'orders' ? (
                <>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="expired">Expired</option>
                  <option value="refunded">Refunded</option>
                </>
              ) : (
                <>
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="replied">Replied</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                  <option value="spam">Spam</option>
                </>
              )}
            </select>
          </label>
        )}
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            {tab === 'orders' ? (
              <tr><th>Date</th><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Actions</th></tr>
            ) : tab === 'customers' ? (
              <tr><th>Customer</th><th>Email</th><th>Orders</th><th>Lifetime spend</th><th>Last order</th><th>Actions</th></tr>
            ) : (
              <tr><th>Date</th><th>Name</th><th>Subject</th><th>Email</th><th>Status</th><th>Actions</th></tr>
            )}
          </thead>
          <tbody>
            {tab === 'orders' ? (
              filteredOrders.length ? filteredOrders.map(order => (
                <tr key={order.id}>
                  <td>{displayDate(order.paidAt || order.createdAt)}</td>
                  <td><button onClick={() => setSelectedOrder(order)}>{order.orderNumber || order.id}</button></td>
                  <td>{order.customerName}<br /><small>{order.customerEmail}</small></td>
                  <td>{(order.songs || order.items || []).map((item: any) => item.title || item.name).join(', ')}</td>
                  <td>{money(order.amountTotal)}</td>
                  <td>{order.paymentStatus || order.status}</td>
                  <td><button disabled={actionId === order.id || String(order.status).toLowerCase() !== 'paid'} onClick={() => regenerateDownload(order)}><RefreshCw size={14} /> Regenerate</button></td>
                </tr>
              )) : <tr><td colSpan={7}>No matching orders.</td></tr>
            ) : tab === 'customers' ? (
              filteredCustomers.length ? filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td>{customer.name || '—'}</td>
                  <td>{customer.email || customer.id}</td>
                  <td>{customer.totalOrders ?? orders.filter(order => order.customerEmail === customer.email).length}</td>
                  <td>{money(customer.lifetimeSpend)}</td>
                  <td>{displayDate(customer.lastOrderAt || customer.updatedAt)}</td>
                  <td><button onClick={() => { setSelectedCustomer(customer); setNotes(customer.notes || ''); }}>Open CRM</button></td>
                </tr>
              )) : <tr><td colSpan={6}>No customers.</td></tr>
            ) : (
              filteredEnquiries.length ? filteredEnquiries.map(enquiry => (
                <tr key={enquiry.id}>
                  <td>{displayDate(enquiry.createdAt)}</td>
                  <td>{enquiry.name}</td>
                  <td><strong>{enquiry.subject}</strong><br /><small>{enquiry.message}</small></td>
                  <td>{enquiry.email}</td>
                  <td>
                    <select value={enquiry.status || 'new'} onChange={event => setEnquiryStatus(enquiry.id, event.target.value)}>
                      <option value="new">New</option><option value="read">Read</option><option value="replied">Replied</option><option value="resolved">Resolved</option><option value="archived">Archived</option><option value="spam">Spam</option>
                    </select>
                  </td>
                  <td><button onClick={() => setSelectedEnquiry(enquiry)}>View & reply</button></td>
                </tr>
              )) : <tr><td colSpan={6}>No enquiries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <section className="admin-dashboard-grid">
          <article style={{ gridColumn: '1 / -1' }}>
            <h2>Order details</h2>
            <p><strong>{selectedOrder.orderNumber || selectedOrder.id}</strong> · {displayDate(selectedOrder.paidAt || selectedOrder.createdAt)}</p>
            <p>{selectedOrder.customerName} · {selectedOrder.customerEmail}</p>
            <p>Stripe: {selectedOrder.stripePaymentIntentId || '—'} · Email: {selectedOrder.emailStatus || '—'} · Download: {selectedOrder.downloadStatus || '—'}</p>
            <table><thead><tr><th>Song</th><th>Artist</th><th>Album</th><th>Price</th></tr></thead><tbody>{(selectedOrder.songs || []).map((song: any, index: number) => <tr key={song.id || index}><td>{song.title}</td><td>{song.artist || song.artistName}</td><td>{song.albumTitle || 'Single'}</td><td>{money(song.unitAmount)}</td></tr>)}</tbody></table>
            <button onClick={() => setSelectedOrder(null)}>Close</button>
          </article>
        </section>
      )}

      {selectedCustomer && (
        <section className="admin-dashboard-grid">
          <article style={{ gridColumn: '1 / -1' }}>
            <h2>Customer CRM</h2>
            <p><strong>{selectedCustomer.name || selectedCustomer.email}</strong> · {selectedCustomer.email}</p>
            <p>{customerOrders.length} orders · {money(selectedCustomer.lifetimeSpend || customerOrders.reduce((total, order) => total + Number(order.amountTotal || 0), 0))} lifetime spend · {customerDownloads.length} purchased tracks</p>
            <label>Internal notes<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label>
            <button className="primary-button" onClick={saveNotes}><Save size={14} /> Save notes</button>
            <h3>Purchase history</h3>
            <table><thead><tr><th>Date</th><th>Order</th><th>Music</th><th>Total</th><th>Status</th></tr></thead><tbody>{customerOrders.map(order => <tr key={order.id}><td>{displayDate(order.paidAt || order.createdAt)}</td><td>{order.orderNumber || order.id}</td><td>{(order.songs || []).map((song: any) => song.title).join(', ')}</td><td>{money(order.amountTotal)}</td><td>{order.status || order.paymentStatus}</td></tr>)}</tbody></table>
            <button onClick={() => setSelectedCustomer(null)}>Close</button>
          </article>
        </section>
      )}

      {selectedEnquiry && (
        <section className="admin-dashboard-grid">
          <article style={{ gridColumn: '1 / -1' }}>
            <h2>{selectedEnquiry.subject}</h2>
            <p><strong>{selectedEnquiry.name}</strong> · {selectedEnquiry.email} · {displayDate(selectedEnquiry.createdAt)}</p>
            <p>{selectedEnquiry.message}</p>
            <h3>Reply history</h3>
            {(selectedEnquiry.replies || []).length ? (selectedEnquiry.replies || []).map((item: any, index: number) => <blockquote key={index}><p>{item.message}</p><small>{item.sentBy} · {displayDate(item.sentAt)}</small></blockquote>) : <p>No replies sent yet.</p>}
            <label>Reply<textarea value={reply} onChange={event => setReply(event.target.value)} placeholder="Write a professional reply…" /></label>
            <button className="primary-button" disabled={actionId === selectedEnquiry.id} onClick={sendReply}><Send size={14} /> {actionId === selectedEnquiry.id ? 'Sending…' : 'Send reply'}</button>
            <button onClick={() => setSelectedEnquiry(null)}>Close</button>
          </article>
        </section>
      )}
    </AdminShell>
  );
}
