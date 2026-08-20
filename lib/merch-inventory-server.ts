import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export type MerchandiseReservationItem = {
  id: string;
  name: string;
  quantity: number;
  size?: string;
  colour?: string;
};

type ReservationStatus = 'reserved' | 'confirmed' | 'released';

function objectValue(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanQuantity(value: unknown) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function groupItems(items: MerchandiseReservationItem[]) {
  const byProduct = new Map<string, MerchandiseReservationItem[]>();
  for (const item of items) {
    if (!item?.id) continue;
    const line = { ...item, quantity: cleanQuantity(item.quantity), size: String(item.size || ''), colour: String(item.colour || '') };
    byProduct.set(line.id, [...(byProduct.get(line.id) || []), line]);
  }
  return byProduct;
}

function reservationRef(id: string) {
  return adminFirestore.collection('inventoryReservations').doc(id);
}

export async function reserveMerchandiseInventory(reservationId: string, items: MerchandiseReservationItem[], expiresAt: Date) {
  const grouped = groupItems(items);
  if (!reservationId || !grouped.size) return;

  await adminFirestore.runTransaction(async transaction => {
    const ref = reservationRef(reservationId);
    const existing = await transaction.get(ref);
    if (existing.exists) throw new Error('RESERVATION_EXISTS');

    const snapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const productId of grouped.keys()) {
      snapshots.set(productId, await transaction.get(adminFirestore.collection('products').doc(productId)));
    }

    for (const [productId, lines] of grouped) {
      const snapshot = snapshots.get(productId);
      if (!snapshot?.exists) throw new Error('ITEM_NOT_FOUND');
      const data = snapshot.data() || {};
      const details = objectValue(data.details);
      const status = String(data.status || 'published').toLowerCase();
      if (!['published', 'active', 'live'].includes(status) || data.available === false || details.available === false) throw new Error('ITEM_NOT_AVAILABLE');

      const rawSizeStock = objectValue(data.sizeStock ?? details.sizeStock);
      const sizeStock = Object.fromEntries(Object.entries(rawSizeStock).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]));

      if (Object.keys(sizeStock).length) {
        const requiredBySize = new Map<string, number>();
        for (const line of lines) requiredBySize.set(String(line.size || ''), (requiredBySize.get(String(line.size || '')) || 0) + cleanQuantity(line.quantity));
        const nextSizeStock = { ...sizeStock };
        for (const [size, required] of requiredBySize) {
          const current = Number(nextSizeStock[size] || 0);
          if (current < required) throw new Error(current <= 0 ? 'OUT_OF_STOCK' : 'STOCK_EXCEEDED');
          nextSizeStock[size] = current - required;
        }
        const nextTotal = Object.values(nextSizeStock).reduce((sum, value) => sum + Number(value || 0), 0);
        transaction.set(snapshot.ref, {
          sizeStock: nextSizeStock,
          stock: nextTotal,
          available: nextTotal > 0,
          updatedAt: FieldValue.serverTimestamp(),
          details: { ...details, sizeStock: nextSizeStock, stock: nextTotal, available: nextTotal > 0 },
        }, { merge: true });
      } else {
        const rawStock = data.stock ?? details.stock;
        if (rawStock !== undefined && rawStock !== null && rawStock !== '') {
          const current = Math.max(0, Math.floor(Number(rawStock) || 0));
          const required = lines.reduce((sum, line) => sum + cleanQuantity(line.quantity), 0);
          if (current < required) throw new Error(current <= 0 ? 'OUT_OF_STOCK' : 'STOCK_EXCEEDED');
          const next = current - required;
          transaction.set(snapshot.ref, {
            stock: next,
            available: next > 0,
            updatedAt: FieldValue.serverTimestamp(),
            details: { ...details, stock: next, available: next > 0 },
          }, { merge: true });
        }
      }
    }

    transaction.create(ref, {
      status: 'reserved' satisfies ReservationStatus,
      items: items.map(item => ({ id: item.id, name: item.name, quantity: cleanQuantity(item.quantity), size: item.size || '', colour: item.colour || '' })),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function releaseMerchandiseReservation(reservationId: string, reason: string) {
  if (!reservationId) return { released: false, status: 'missing' };
  return adminFirestore.runTransaction(async transaction => {
    const ref = reservationRef(reservationId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { released: false, status: 'missing' };
    const data = snapshot.data() || {};
    const status = String(data.status || '');
    if (status !== 'reserved') return { released: false, status };

    const items = (Array.isArray(data.items) ? data.items : []) as MerchandiseReservationItem[];
    const grouped = groupItems(items);
    const productSnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const productId of grouped.keys()) productSnapshots.set(productId, await transaction.get(adminFirestore.collection('products').doc(productId)));

    for (const [productId, lines] of grouped) {
      const product = productSnapshots.get(productId);
      if (!product?.exists) continue;
      const productData = product.data() || {};
      const details = objectValue(productData.details);
      const rawSizeStock = objectValue(productData.sizeStock ?? details.sizeStock);
      const sizeStock = Object.fromEntries(Object.entries(rawSizeStock).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))]));

      if (Object.keys(sizeStock).length) {
        const nextSizeStock = { ...sizeStock };
        for (const line of lines) {
          const size = String(line.size || '');
          nextSizeStock[size] = Number(nextSizeStock[size] || 0) + cleanQuantity(line.quantity);
        }
        const nextTotal = Object.values(nextSizeStock).reduce((sum, value) => sum + Number(value || 0), 0);
        transaction.set(product.ref, {
          sizeStock: nextSizeStock,
          stock: nextTotal,
          available: nextTotal > 0,
          updatedAt: FieldValue.serverTimestamp(),
          details: { ...details, sizeStock: nextSizeStock, stock: nextTotal, available: nextTotal > 0 },
        }, { merge: true });
      } else {
        const rawStock = productData.stock ?? details.stock;
        if (rawStock !== undefined && rawStock !== null && rawStock !== '') {
          const current = Math.max(0, Math.floor(Number(rawStock) || 0));
          const releasedQty = lines.reduce((sum, line) => sum + cleanQuantity(line.quantity), 0);
          const next = current + releasedQty;
          transaction.set(product.ref, {
            stock: next,
            available: next > 0,
            updatedAt: FieldValue.serverTimestamp(),
            details: { ...details, stock: next, available: next > 0 },
          }, { merge: true });
        }
      }
    }

    transaction.set(ref, {
      status: 'released' satisfies ReservationStatus,
      releaseReason: String(reason || 'released').slice(0, 100),
      releasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { released: true, status: 'released' };
  });
}

export async function confirmMerchandiseReservation(reservationId: string, stripeCheckoutSessionId: string) {
  if (!reservationId) return { confirmed: false, status: 'missing' };
  return adminFirestore.runTransaction(async transaction => {
    const ref = reservationRef(reservationId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { confirmed: false, status: 'missing' };
    const status = String(snapshot.data()?.status || '');
    if (status === 'confirmed') return { confirmed: true, status };
    if (status !== 'reserved') return { confirmed: false, status };
    transaction.set(ref, {
      status: 'confirmed' satisfies ReservationStatus,
      stripeCheckoutSessionId,
      confirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { confirmed: true, status: 'confirmed' };
  });
}
