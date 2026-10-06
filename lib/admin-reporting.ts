type Row = Record<string, any>;

export type RevenueSummary = {
  gross: number;
  fees: number;
  refunds: number;
  net: number;
  paidOrderCount: number;
  subscriptionPaymentCount: number;
  transactionCount: number;
  listenerRevenue: number;
  creatorRevenue: number;
};

export const asDate = (value: any) => value?.toDate?.() || new Date(value || 0);
export const money = (cents: number) => `€${(Number(cents || 0) / 100).toFixed(2)}`;

const paidValues = new Set(['paid', 'succeeded', 'complete', 'completed']);

export function isPaidOrder(order: Row) {
  return paidValues.has(String(order.status || order.paymentStatus || '').toLowerCase());
}

export function isPaidSubscriptionPayment(payment: Row) {
  return paidValues.has(String(payment.status || payment.paymentStatus || '').toLowerCase()) || payment.paid === true;
}

export function orderTotal(order: Row) {
  return Number(order.amountTotal ?? order.total ?? order.amount ?? 0);
}

export function subscriptionPaymentTotal(payment: Row) {
  return Number(payment.amountPaid ?? payment.amountTotal ?? payment.amount ?? payment.total ?? 0);
}

export function stripeFeeCents(row: Row) {
  return Number(row.stripeFee ?? row.stripeFeeAmount ?? row.feeAmount ?? row.fees ?? 0);
}

export function refundTotal(refund: Row) {
  return Number(refund.amountRefunded ?? refund.refundAmount ?? refund.amount ?? refund.total ?? 0);
}

export function paidAt(row: Row) {
  return row.paidAt || row.createdAt || row.recordedAt;
}

export function planType(row: Row) {
  const value = String(row.plan || row.planType || row.membershipPlan || '').toLowerCase();
  return value === 'creator' ? 'creator' : value === 'listener' ? 'listener' : '';
}

export function inRange(value: any, start: Date, end: Date) {
  const time = asDate(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

export function irelandDayKey(value: any) {
  const date = asDate(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function isIrelandBusinessDay(value: any, comparison: Date = new Date()) {
  const key = irelandDayKey(value);
  return Boolean(key) && key === irelandDayKey(comparison);
}

export function buildRevenueSummary(
  orders: Row[],
  subscriptionPayments: Row[] = [],
  refunds: Row[] = [],
  range?: { start: Date; end: Date },
): RevenueSummary {
  const orderRows = orders.filter(order => isPaidOrder(order) && (!range || inRange(paidAt(order), range.start, range.end)));
  const subscriptionRows = subscriptionPayments.filter(payment => isPaidSubscriptionPayment(payment) && (!range || inRange(paidAt(payment), range.start, range.end)));
  const refundRows = refunds.filter(refund => !range || inRange(refund.refundedAt || refund.createdAt || refund.updatedAt, range.start, range.end));

  const orderGross = orderRows.reduce((total, order) => total + orderTotal(order), 0);
  const subscriptionGross = subscriptionRows.reduce((total, payment) => total + subscriptionPaymentTotal(payment), 0);
  const fees = [...orderRows, ...subscriptionRows].reduce((total, row) => total + stripeFeeCents(row), 0);
  const refundAmount = refundRows.reduce((total, refund) => total + refundTotal(refund), 0);

  const listenerRevenue = subscriptionRows
    .filter(payment => planType(payment) === 'listener')
    .reduce((total, payment) => total + subscriptionPaymentTotal(payment), 0);
  const creatorRevenue = subscriptionRows
    .filter(payment => planType(payment) === 'creator')
    .reduce((total, payment) => total + subscriptionPaymentTotal(payment), 0);

  const gross = orderGross + subscriptionGross;
  return {
    gross,
    fees,
    refunds: refundAmount,
    net: gross - fees - refundAmount,
    paidOrderCount: orderRows.length,
    subscriptionPaymentCount: subscriptionRows.length,
    transactionCount: orderRows.length + subscriptionRows.length,
    listenerRevenue,
    creatorRevenue,
  };
}

export function songQuantity(order: Row) {
  if (Array.isArray(order.songs)) {
    return order.songs.reduce((total: number, song: Row) => total + Number(song.quantity || 1), 0);
  }
  if (order.type === 'song' || order.orderType === 'song' || order.purchaseType === 'music') return Number(order.quantity || 1);
  return 0;
}

export function merchandiseQuantity(order: Row) {
  if (Array.isArray(order.items)) {
    return order.items
      .filter((item: Row) => !item.digital)
      .reduce((total: number, item: Row) => total + Number(item.quantity || 1), 0);
  }
  if (Array.isArray(order.products)) {
    return order.products.reduce((total: number, item: Row) => total + Number(item.quantity || 1), 0);
  }
  if (order.type === 'merchandise' || order.orderType === 'merchandise' || order.purchaseType === 'merchandise') return Number(order.quantity || 1);
  return 0;
}
