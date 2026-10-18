const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/runtime-safety.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleShim = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleShim.exports, module: moduleShim, process: { env: {} } });
const safety = moduleShim.exports;

const localEnvironment = {
  AUREON_ENVIRONMENT: 'local-test',
  NEXT_PUBLIC_AUREON_ENVIRONMENT: 'local-test',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-aureon-music-group',
  FIREBASE_ADMIN_PROJECT_ID: 'demo-aureon-music-group',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_12345678901234567890',
};

test('test mode accepts only matching local Firebase emulators and Stripe test keys', () => {
  assert.equal(safety.assertRuntimeIsolation(localEnvironment), true);
  assert.doesNotThrow(() => safety.assertStripeKeyIsolation('sk_test_12345678901234567890', localEnvironment));
  assert.doesNotThrow(() => safety.assertWebhookMode(false, localEnvironment));
});

test('test mode fails closed on missing flags, production Firebase, remote emulators or cloud credentials', () => {
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, AUREON_ENVIRONMENT: undefined }), /matching server and browser/);
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, FIREBASE_ADMIN_PROJECT_ID: 'aureon-music-group' }), /requires both Firebase SDKs/);
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, FIRESTORE_EMULATOR_HOST: 'firestore.example.com:8080' }), /local Auth, Firestore and Storage/);
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, FIREBASE_ADMIN_PRIVATE_KEY: 'not-a-real-key' }), /must not use Firebase service-account/);
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/prod.json' }), /cannot use cloud credentials/);
  assert.throws(() => safety.assertRuntimeIsolation({ ...localEnvironment, VERCEL: '1' }), /cannot run on Vercel/);
});

test('test mode rejects live Stripe credentials and live webhook events', () => {
  assert.throws(() => safety.assertStripeKeyIsolation('sk_live_never-use', localEnvironment), /requires a Stripe test-mode secret/);
  assert.throws(() => safety.assertStripeKeyIsolation('sk_test_12345678901234567890', { ...localEnvironment, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_never-use' }), /requires a Stripe test-mode publishable/);
  assert.throws(() => safety.assertWebhookMode(true, localEnvironment), /cannot process live Stripe events/);
});

test('Stripe test credentials and events are rejected outside explicit emulator mode', () => {
  assert.throws(() => safety.assertStripeKeyIsolation('sk_test_never-use', {}), /permitted only with the isolated Aureon local-test/);
  assert.throws(() => safety.assertStripeKeyIsolation('sk_live_ok', { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_never-use' }), /publishable keys are permitted only/);
  assert.throws(() => safety.assertWebhookMode(false, {}), /accepted only by the isolated local-test/);
  assert.throws(() => safety.assertWebhookMode(true, { ...localEnvironment, AUREON_ENVIRONMENT: undefined }), /matching server and browser/);
});

test('Firebase CLI defaults to demo project and local builds use emulators', () => {
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  const aliases = JSON.parse(fs.readFileSync(path.join(root, '.firebaserc'), 'utf8'));
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(aliases.projects.default, 'demo-aureon-music-group');
  assert.equal(firebase.emulators.auth.port, 9099);
  assert.equal(firebase.emulators.firestore.port, 8080);
  assert.equal(firebase.emulators.storage.port, 9199);
  assert.match(packageJson.scripts['build:local-test'], /emulators:exec/);
  assert.match(packageJson.scripts['build:local-test'], /demo-aureon-music-group/);
});

test('browser and server analytics are disabled from Google in local test mode', () => {
  const bridge = fs.readFileSync(path.join(root, 'components/AnalyticsBridge.tsx'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'lib/analytics-server.ts'), 'utf8');
  assert.match(bridge, /NEXT_PUBLIC_AUREON_ENVIRONMENT!=='local-test'/);
  assert.match(server, /skipped_test_environment/);
  assert.match(server, /isLocalTestEnvironment\(\).*local_test_events_are_not_sent_to_google_analytics/);
});
