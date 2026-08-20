'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Clock3, Download, Package, PackageCheck, Truck } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import './fulfilment.css';

type Order = { id: string; [key: string]: any };
type FulfilmentStatus = 'awaiting_fulfilment' | 'processing' | 'shipped';

function toDate(value: any) {
  try { return value?.toDate?.() || new Date(value); } catch { return new Date(0); }
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function addressText(address: any) {
  if (!address) return '';
  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(', ');
}

function money(order: Order) {
  const currency = String(order.currency || 'EUR').toUpperCase();
  const amount = Number(order.amountTotal || 0) / 100;
  try { return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function statusLabel(status: string) {
  if (status === 'awaiting_fulfilment') return 'Awaiting fulfilment';
  if (status === 'processing') return 'Processing';
  if (status === 'shipped') return 'Shipped';
  if (status === 'manual_review') return 'Manual review';
  return status || 'Awaiting fulfilment';
}

export default function FulfilmentPage() {
  const { authorised, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    return onSnapshot(collection(firestore, 'orders'), snapshot => {
      const nextOrders: Order[] = snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Record<string, any>) }));
      setOrders(nextOrders.filter(order => Array.isArray(order.products) && order.products.length > 0 && String(order.status).toLowerCase() === 'paid').sort((a, b) => toDate(b.paidAt || b.createdAt).getTime() - toDate(a.paidAt || a.createdAt).getTime()));
    });
  }, [authorised, loading]);

  const last24Hours = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return orders.filter(order => toDate(order.paidAt || order.createdAt).getTime() >= cutoff);
  }, [orders]);

  const units24h = useMemo(() => last24Hours.reduce((sum, order) => sum + (order.products || []).reduce((lineSum: number, item: any) => lineSum + Number(item.quantity || 0), 0), 0), [last24Hours]);

  function downloadReport() {
    const headers = ['Order Date','Order Time','Order Number','Customer Name','Email','Phone','Delivery Address','Product','Quantity','Size','Colour / Spec','Order Total','Currency','Payment Status','Fulfilment Status'];
    const rows: string[][] = [];
    for (const order of last24Hours) {
      const date = toDate(order.paidAt || order.createdAt);
      for (const item of order.products || []) {
        rows.push([
          date.toLocaleDateString('en-IE'), date.toLocaleTimeString('en-IE'), order.orderNumber || order.id,
          order.customerName || '', order.customerEmail || '', order.customerPhone || '', addressText(order.deliveryAddress),
          item.name || '', String(item.quantity || 1), item.size || '', item.colour || '',
          (Number(order.amountTotal || 0) / 100).toFixed(2), String(order.currency || 'EUR').toUpperCase(),
          order.paymentStatus || order.status || '', order.fulfilmentStatus || 'awaiting_fulfilment',
        ]);
      }
    }
    const csv = [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `Aureon-Merch-Fulfilment-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    setMessage(`Downloaded ${rows.length} merchandise line items from the last 24 hours.`);
  }

  async function setStatus(order: Order, status: FulfilmentStatus) {
    const key = `${order.id}-${status}`;
    setBusy(key);
    setMessage('');
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        fulfilmentStatus: status,
        updatedAt: serverTimestamp(),
        ...(status === 'awaiting_fulfilment' ? { processingAt: null, shippedAt: null } : {}),
        ...(status === 'processing' ? { processingAt: serverTimestamp(), shippedAt: null } : {}),
        ...(status === 'shipped' ? { shippedAt: serverTimestamp() } : {}),
      });
      setMessage(`${order.orderNumber || order.id} marked ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update fulfilment status.');
    } finally {
      setBusy('');
    }
  }

  const actions = (order: Order) => <div className="fulfilment-actions">
    <button disabled={Boolean(busy)} onClick={() => setStatus(order,'awaiting_fulfilment')}><Package size={14}/> Awaiting</button>
    <button disabled={Boolean(busy)} onClick={() => setStatus(order,'processing')}><PackageCheck size={14}/> Processing</button>
    <button disabled={Boolean(busy)} onClick={() => setStatus(order,'shipped')}><Truck size={14}/> Shipped</button>
  </div>;

  return <AdminShell>
    <div className="admin-page-heading"><p className="admin-kicker">Merchandise operations</p><h1>Daily Fulfilment</h1><p>Paid merchandise orders with the customer, delivery, payment and dispatch information staff need to pack and ship correctly.</p></div>
    {message && <div className="admin-cms-message">{message}</div>}
    <section className="admin-dashboard-grid fulfilment-summary">
      <article><p className="admin-kicker">Last 24 hours</p><h2>{last24Hours.length}</h2><p>Paid merchandise orders</p></article>
      <article><p className="admin-kicker">Units sold</p><h2>{units24h}</h2><p>Total merchandise units in the last 24 hours</p></article>
      <article><p className="admin-kicker">Dispatch report</p><button className="primary-button" onClick={downloadReport} disabled={!last24Hours.length}><Download size={16}/> Download 24h Excel CSV</button><p><small>Includes all packing, delivery, payment and fulfilment fields.</small></p></article>
    </section>

    <div className="admin-table-wrap fulfilment-table"><table><thead><tr><th>Date</th><th>Time</th><th>Order number</th><th>Customer</th><th>Email / phone</th><th>Delivery address</th><th>Product / variant</th><th>Qty</th><th>Total / currency</th><th>Payment</th><th>Fulfilment</th><th>Actions</th></tr></thead>
      <tbody>{orders.length ? orders.map(order => {
        const date = toDate(order.paidAt || order.createdAt);
        const products = order.products || [];
        return <tr key={order.id}>
          <td>{date.toLocaleDateString('en-IE')}</td><td>{date.toLocaleTimeString('en-IE')}</td><td><strong>{order.orderNumber || order.id}</strong></td>
          <td>{order.customerName || '—'}</td><td><small>{order.customerEmail || '—'}<br/>{order.customerPhone || '—'}</small></td><td>{addressText(order.deliveryAddress) || 'Address not captured'}</td>
          <td>{products.map((item: any, index: number) => <div key={`${item.id || item.name}-${index}`} className="fulfilment-line"><strong>{item.name}</strong>{item.size ? <span>Size: {item.size}</span> : null}{item.colour ? <span>Colour / spec: {item.colour}</span> : null}</div>)}</td>
          <td>{products.map((item: any, index: number) => <div key={`${item.id || item.name}-qty-${index}`}>{item.quantity || 1}</div>)}</td>
          <td><strong>{money(order)}</strong><br/><small>{String(order.currency || 'EUR').toUpperCase()}</small></td><td>{String(order.paymentStatus || order.status || '—').toUpperCase()}</td>
          <td><strong>{statusLabel(String(order.fulfilmentStatus || 'awaiting_fulfilment'))}</strong></td><td>{actions(order)}</td>
        </tr>;
      }) : <tr><td colSpan={12}>No paid merchandise orders yet.</td></tr>}</tbody>
    </table></div>

    <section className="fulfilment-mobile-list" aria-label="Merchandise fulfilment orders">
      {orders.length ? orders.map(order => {
        const date = toDate(order.paidAt || order.createdAt);
        return <article className="fulfilment-mobile-card" key={`mobile-${order.id}`}>
          <div className="fulfilment-mobile-head"><div><small>Order</small><strong>{order.orderNumber || order.id}</strong></div><span>{statusLabel(String(order.fulfilmentStatus || 'awaiting_fulfilment'))}</span></div>
          <dl>
            <div><dt><Clock3 size={14}/> Date / time</dt><dd>{date.toLocaleDateString('en-IE')} · {date.toLocaleTimeString('en-IE')}</dd></div>
            <div><dt>Customer</dt><dd>{order.customerName || '—'}</dd></div>
            <div><dt>Email</dt><dd>{order.customerEmail || '—'}</dd></div>
            <div><dt>Phone</dt><dd>{order.customerPhone || '—'}</dd></div>
            <div><dt>Delivery address</dt><dd>{addressText(order.deliveryAddress) || 'Address not captured'}</dd></div>
            <div><dt>Products</dt><dd>{(order.products || []).map((item: any, index: number) => <div key={`${item.id || item.name}-mobile-${index}`} className="fulfilment-line"><strong>{item.quantity || 1} × {item.name}</strong>{item.size ? <span>Size: {item.size}</span> : null}{item.colour ? <span>Colour / spec: {item.colour}</span> : null}</div>)}</dd></div>
            <div><dt>Order total</dt><dd>{money(order)} · {String(order.currency || 'EUR').toUpperCase()}</dd></div>
            <div><dt>Payment status</dt><dd>{String(order.paymentStatus || order.status || '—').toUpperCase()}</dd></div>
            <div><dt>Fulfilment status</dt><dd>{statusLabel(String(order.fulfilmentStatus || 'awaiting_fulfilment'))}</dd></div>
          </dl>
          {actions(order)}
        </article>;
      }) : <p>No paid merchandise orders yet.</p>}
    </section>
  </AdminShell>;
}
