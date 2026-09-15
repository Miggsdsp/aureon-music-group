const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function harness() {
  const records = new Map();
  const sends = [];
  let failedKind = '';
  let chain = Promise.resolve();
  const field = {
    increment: value => ({ op: 'increment', value }),
    arrayUnion: (...value) => ({ op: 'union', value }),
    serverTimestamp: () => ({ toDate: () => new Date('2026-09-10T10:00:00Z') }),
    delete: () => ({ op: 'delete' }),
  };
  function write(path, value, options) {
    const next = options?.merge ? { ...records.get(path) } : {};
    for (const [key, item] of Object.entries(value)) {
      if (item?.op === 'delete') delete next[key];
      else if (item?.op === 'increment') next[key] = (next[key] || 0) + item.value;
      else if (item?.op === 'union') next[key] = [...new Set([...(next[key] || []), ...item.value])];
      else next[key] = item;
    }
    records.set(path, next);
  }
  function doc(path) {
    return { path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`),
      get: async () => ({ exists: records.has(path), id: path.split('/').at(-1), ref: doc(path), data: () => records.get(path) }),
      set: async (value, options) => write(path, value, options) };
  }
  function collection(path) {
    return { doc: id => doc(`${path}/${id}`), where: (key, op, value) => ({
      get: async () => ({ docs: await Promise.all([...records.keys()].filter(p => p.startsWith(`${path}/`) && !p.slice(path.length + 1).includes('/') && records.get(p)[key] === value).map(p => doc(p).get())) }),
    }) };
  }
  const db = { collection, runTransaction: fn => {
    const run = chain.then(async () => {
      const writes = [];
      const result = await fn({ get: ref => ref.get(), set: (ref, value, options) => writes.push(() => write(ref.path, value, options)) });
      writes.forEach(write => write());
      return result;
    });
    chain = run.catch(() => {});
    return run;
  }};
  const send = kind => async input => {
    sends.push({ kind, input });
    if (failedKind === kind) throw new Error('Temporary provider outage');
    return { sent: true };
  };
  const email = { sendPurchaseReceiptEmail: send('receipt'), sendPurchaseDownloadEmail: send('download'), sendFulfilmentOrderNotification: send('operations') };
  function load(path, imports, suffix = '') {
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8') + suffix, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, { exports: module.exports, module, require: name => name in imports ? imports[name] : require(name), process, console, Date, AbortSignal, fetch, Request }, { filename: path });
    return module.exports;
  }
  const common = { '@/lib/firebase-admin': { adminFirestore: db }, 'firebase-admin/firestore': { FieldValue: field } };
  const helper = load('lib/purchase-email-fulfilment.ts', { ...common, '@/lib/transactional-email': email });
  const webhook = load('app/api/stripe/webhook/route.ts', { ...common,
    '@/lib/purchase-email-fulfilment': helper,
    '@/lib/analytics-server': { analyticsContextFromStripe: () => ({ analyticsConsent:false }), recordTrustedAnalyticsEvent: async () => ({ created:true }) },
    '@/lib/stripe-server': {},
    '@/lib/merch-inventory-server': {},
    'next/server': {}, stripe: {},
  }, '\nexport { fulfilPaidCheckout };');
  function seed(mixed = false) {
    records.set('songs/song-1', { title: 'Track', artist: 'Artist', privateFilePath: 'private/full-tracks/song.wav', price: 1.29 });
    records.set('orders/cs_test', { customerEmail: 'test@example.com', items: mixed ? [{ id: 'shirt', name: 'Shirt', quantity: 1, priceCents: 2000, digital: false }] : [] });
    if (mixed) records.set('products/shirt', { stock: 10 });
    return { id: 'cs_test', mode: 'payment', payment_status: 'paid', metadata: { songIds: 'song-1' }, created: 123, amount_total: mixed ? 2129 : 129, currency: 'eur' };
  }
  return { records, sends, seed, helper, webhook, fail: kind => failedKind = kind };
}

test('new purchase sends receipt and dedicated download from one entitlement', async () => {
  const h = harness();
  await h.webhook.fulfilPaidCheckout(h.seed());
  assert.deepEqual(h.sends.map(s => s.kind), ['receipt', 'download']);
  assert.equal([...h.records.keys()].filter(k => k.startsWith('downloads/')).length, 1);
  assert.match(h.sends[1].input.items[0].downloadUrl, /^https:\/\/www\.aureonmusicgroup\.com\/api\/download\/[a-f0-9]{64}$/);
  assert.equal(h.records.get('orders/cs_test').receiptEmailStatus, 'sent');
  assert.equal(h.records.get('orders/cs_test').downloadEmailStatus, 'sent');
});

test('failed receipt still sends download; retry does not recount sale, decrement stock, or resend successful emails', async () => {
  const h = harness(); const session = h.seed(true); h.fail('receipt');
  await assert.rejects(h.webhook.fulfilPaidCheckout(session));
  assert.equal(h.records.get('orders/cs_test').downloadEmailStatus, 'sent');
  assert.equal(h.records.get('products/shirt').stock, 9);
  const tokens = [...h.records.keys()].filter(k => k.startsWith('downloads/'));
  h.fail(''); h.records.delete('songs/song-1');
  await h.webhook.fulfilPaidCheckout(session);
  assert.equal(h.records.get('customers/test@example.com').totalOrders, 1);
  assert.equal(h.records.get('products/shirt').stock, 9);
  assert.deepEqual([...h.records.keys()].filter(k => k.startsWith('downloads/')), tokens);
  assert.deepEqual(h.sends.map(s => s.kind), ['receipt', 'download', 'operations', 'receipt']);
  assert.equal(h.records.get('orders/cs_test').purchaseEmailsPending, false);
});

test('failed download retries same payload and idempotency key without resetting used entitlement', async () => {
  const h = harness(); const session = h.seed(); h.fail('download');
  await assert.rejects(h.webhook.fulfilPaidCheckout(session));
  const key = [...h.records.keys()].find(k => k.startsWith('downloads/'));
  Object.assign(h.records.get(key), { downloadCount: 1, status: 'used' });
  const expiry = h.records.get(key).expiresAt.getTime();
  h.fail(''); await h.webhook.fulfilPaidCheckout(session);
  const downloads = h.sends.filter(s => s.kind === 'download');
  assert.deepEqual(downloads[0].input, downloads[1].input);
  assert.equal(h.records.get(key).downloadCount, 1);
  assert.equal(h.records.get(key).expiresAt.getTime(), expiry);
});

test('concurrent duplicate checkouts create one sale and send each email once', async () => {
  const h = harness(); const session = h.seed();
  await Promise.allSettled([h.webhook.fulfilPaidCheckout(session), h.webhook.fulfilPaidCheckout(session)]);
  await h.webhook.fulfilPaidCheckout(session);
  assert.equal(h.records.get('customers/test@example.com').totalOrders, 1);
  assert.equal(h.sends.filter(s => s.kind === 'receipt').length, 1);
  assert.equal(h.sends.filter(s => s.kind === 'download').length, 1);
});

test('unpaid checkout creates no purchase or email', async () => {
  const h = harness(); const session = h.seed(); session.payment_status = 'unpaid';
  await h.webhook.fulfilPaidCheckout(session);
  assert.equal(h.sends.length, 0);
  assert.equal(h.records.has('customers/test@example.com'), false);
});
