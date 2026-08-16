'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Download, PackageCheck, Truck } from 'lucide-react';
import { firestore } from '@/lib/firebase-client';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';

type Order = { id: string; [key: string]: any };

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

export default function FulfilmentPage() {
  const { authorised, loading } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (loading || !authorised) return;
    return onSnapshot(collection(firestore, 'orders'), snapshot => {
      setOrders(snapshot.docs.map(item => ({ id: item.id, ...item.data() })).filter(order => Array.isArray(order.products) && order.products.length > 0 && String(order.status).toLowerCase() === 'paid').sort((a, b) => toDate(b.paidAt || b.createdAt).getTime() - toDate(a.paidAt || a.createdAt).getTime()));
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
          date.toLocaleDateString('en-IE'),
          date.toLocaleTimeString('en-IE'),
          order.orderNumber || order.id,
          order.customerName || '',
          order.customerEmail || '',
          order.customerPhone || '',
          addressText(order.deliveryAddress),
          item.name || '',
          String(item.quantity || 1),
          item.size || '',
          item.colour || '',
          (Number(order.amountTotal || 0) / 100).toFixed(2),
          String(order.currency || 'EUR').toUpperCase(),
          order.paymentStatus || order.status || '',
          order.fulfilmentStatus || 'awaiting_fulfilment',
        ]);
      }
    }
    const csv = [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `Aureon-Merch-Fulfilment-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${rows.length} merchandise line items from the last 24 hours.`);
  }

  async function setStatus(order: Order, status: 'processing' | 'shipped') {
    await updateDoc(doc(firestore, 'orders', order.id), { fulfilmentStatus: status, updatedAt: new Date(), ...(status === 'shipped' ? { shippedAt: new Date() } : { processingAt: new Date() }) });
    setMessage(`${order.orderNumber || order.id} marked ${status}.`);
  }

  return <AdminShell>
    <div className="admin-page-heading">
      <p className="admin-kicker">Merchandise operations</p>
      <h1>Daily Fulfilment</h1>
      <p>Paid merchandise orders, delivery details and a dispatch-ready report for the previous 24 hours.</p>
    </div>

    {message && <div className="admin-cms-message">{message}</div>}

    <section className="admin-dashboard-grid">
      <article><p className="admin-kicker">Last 24 hours</p><h2>{last24Hours.length}</h2><p>Paid merchandise orders</p></article>
      <article><p className="admin-kicker">Units to process</p><h2>{units24h}</h2><p>Total merchandise units sold</p></article>
      <article><p className="admin-kicker">Dispatch report</p><button className="primary-button" onClick={downloadReport} disabled={!last24Hours.length}><Download size={16}/> Download 24h Excel CSV</button><p><small>Opens directly in Microsoft Excel, Numbers or Google Sheets.</small></p></article>
    </section>

    <div className="admin-table-wrap">
      <table>
        <thead><tr><th>Date / time</th><th>Order</th><th>Customer</th><th>Delivery address</th><th>Products</th><th>Status</th><th>Dispatch</th></tr></thead>
        <tbody>{orders.length ? orders.map(order => <tr key={order.id}>
          <td>{toDate(order.paidAt || order.createdAt).toLocaleString('en-IE')}</td>
          <td><strong>{order.orderNumber || order.id}</strong><br/><small>€{(Number(order.amountTotal || 0)/100).toFixed(2)}</small></td>
          <td>{order.customerName || '—'}<br/><small>{order.customerEmail || '—'}<br/>{order.customerPhone || '—'}</small></td>
          <td>{addressText(order.deliveryAddress) || 'Address not captured'}</td>
          <td>{(order.products || []).map((item: any, index: number) => <div key={`${item.id || item.name}-${index}`} style={{marginBottom:6}}><strong>{item.quantity || 1} × {item.name}</strong>{item.size ? ` · Size ${item.size}` : ''}{item.colour ? ` · ${item.colour}` : ''}</div>)}</td>
          <td>{order.fulfilmentStatus || 'awaiting_fulfilment'}</td>
          <td><button onClick={() => setStatus(order,'processing')}><PackageCheck size={14}/> Processing</button> <button onClick={() => setStatus(order,'shipped')}><Truck size={14}/> Shipped</button></td>
        </tr>) : <tr><td colSpan={7}>No paid merchandise orders yet.</td></tr>}</tbody>
      </table>
    </div>
  </AdminShell>;
}
