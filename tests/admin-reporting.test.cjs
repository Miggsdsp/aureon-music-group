const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const subscriptionSync = read('lib/subscription-sync.ts');
const subscriptionWebhook = read('app/api/stripe/subscriptions/route.ts');
const checkoutRoute = read('app/api/subscriptions/checkout/route.ts');
const confirmRoute = read('app/api/subscriptions/confirm/route.ts');
const adminReporting = read('lib/admin-reporting.ts');
const adminDashboard = read('app/admin/page.tsx');
const adminAnalytics = read('app/admin/analytics/page.tsx');

assert(subscriptionSync.includes("collection('subscriptionPayments').doc(invoice.id)"), 'subscription payments must be stored by Stripe invoice ID');
assert(subscriptionSync.includes("collection('payments').doc(`subscription_${invoice.id}`)"), 'subscription payments must mirror into payments with a stable subscription invoice key');
assert(subscriptionSync.includes("recordSubscriptionPayment(invoice, subscription, 'invoice.paid', finance)"), 'invoice.paid must record subscription revenue with fee data');
assert(subscriptionSync.includes('stripeFee'), 'subscription payment ledger must preserve Stripe fees where available');
assert(subscriptionWebhook.includes('recordSubscriptionPayment(invoice, subscription, event.type,'), 'checkout.session.completed must record initial subscription revenue without waiting for a success-page visit');
assert(subscriptionWebhook.includes('recordInvoicePaid(invoice, subscription)'), 'invoice.paid must pass the resolved subscription into invoice payment recording');
assert(checkoutRoute.includes("recordSubscriptionPayment(invoice, confirmed, 'account-paid-upgrade')"), 'paid Listener to Creator upgrades must be counted as subscription revenue');
assert(confirmRoute.includes("recordSubscriptionPayment(invoice, subscription, 'checkout-confirmation',"), 'checkout confirmation must repair/report completed subscription invoice revenue idempotently');

assert(adminReporting.includes('Europe/Dublin'), 'admin revenue today must use the Ireland business day');
assert(adminReporting.includes('listenerRevenue'), 'reporting must separate Listener revenue');
assert(adminReporting.includes('creatorRevenue'), 'reporting must separate Creator revenue');
assert(adminReporting.includes('refunds: refundAmount'), 'reporting must subtract refunds from net revenue');
assert(adminReporting.includes('transactionCount: orderRows.length + subscriptionRows.length'), 'Admin Analytics transactions must include orders and subscription payments');

assert(adminDashboard.includes("collection(firestore, 'payments')"), 'Admin Dashboard must read the authorized payments ledger');
assert(adminDashboard.includes("collection(firestore, 'refunds')"), 'Admin Dashboard must read refunds');
assert(adminDashboard.includes('buildRevenueSummary(todayOrders, todaySubscriptions, todayRefunds)'), 'Revenue Today must aggregate orders, subscriptions and refunds');

assert(adminAnalytics.includes("collection(firestore, 'payments')"), 'Admin Analytics must read the authorized payments ledger');
assert(adminAnalytics.includes("collection(firestore, 'refunds')"), 'Admin Analytics must read refunds');
assert(adminAnalytics.includes('Listener revenue'), 'Admin Analytics must display Listener revenue');
assert(adminAnalytics.includes('Creator revenue'), 'Admin Analytics must display Creator revenue');

console.log('Admin reporting regression checks passed.');
