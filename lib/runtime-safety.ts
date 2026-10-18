const LOCAL_TEST_PROJECT_ID = 'demo-aureon-music-group';

type Environment = Record<string, string | undefined>;

function isLocalEndpoint(value: string | undefined) {
  return Boolean(value && /^(localhost|127\.0\.0\.1):\d+$/.test(value));
}

export function isLocalTestEnvironment(env: Environment = process.env) {
  return env.AUREON_ENVIRONMENT === 'local-test';
}

export function assertRuntimeIsolation(env: Environment = process.env) {
  const serverTestMode = env.AUREON_ENVIRONMENT === 'local-test';
  const clientTestMode = env.NEXT_PUBLIC_AUREON_ENVIRONMENT === 'local-test';

  if (serverTestMode !== clientTestMode) {
    throw new Error('Aureon test mode requires matching server and browser environment flags.');
  }

  if (!serverTestMode) return false;

  if (env.VERCEL === '1') {
    throw new Error('Aureon local-test mode cannot run on Vercel deployments.');
  }

  const clientProject = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const adminProject = env.FIREBASE_ADMIN_PROJECT_ID;
  if (clientProject !== LOCAL_TEST_PROJECT_ID || adminProject !== LOCAL_TEST_PROJECT_ID) {
    throw new Error(`Aureon local-test mode requires both Firebase SDKs to use ${LOCAL_TEST_PROJECT_ID}.`);
  }

  if (!isLocalEndpoint(env.FIREBASE_AUTH_EMULATOR_HOST)
    || !isLocalEndpoint(env.FIRESTORE_EMULATOR_HOST)
    || !isLocalEndpoint(env.FIREBASE_STORAGE_EMULATOR_HOST)) {
    throw new Error('Aureon local-test mode requires local Auth, Firestore and Storage emulator endpoints.');
  }

  if (env.FIREBASE_ADMIN_CLIENT_EMAIL || env.FIREBASE_ADMIN_PRIVATE_KEY) {
    throw new Error('Aureon local-test mode must not use Firebase service-account credentials.');
  }

  if (env.GOOGLE_APPLICATION_CREDENTIALS || env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    || (env.GCLOUD_PROJECT && env.GCLOUD_PROJECT !== LOCAL_TEST_PROJECT_ID)) {
    throw new Error('Aureon local-test mode cannot use cloud credentials or a non-test Google Cloud project.');
  }

  return true;
}

export function assertStripeKeyIsolation(secretKey: string, env: Environment = process.env) {
  const testMode = assertRuntimeIsolation(env);
  const publishableKey = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (testMode) {
    if (!/^sk_test_[A-Za-z0-9]{16,}$/.test(secretKey)) {
      throw new Error('Aureon local-test mode requires a Stripe test-mode secret key.');
    }
    if (!publishableKey || !/^pk_test_[A-Za-z0-9]{16,}$/.test(publishableKey)) {
      throw new Error('Aureon local-test mode requires a Stripe test-mode publishable key.');
    }
    return;
  }

  if (secretKey.startsWith('sk_test_')) {
    throw new Error('Stripe test-mode keys are permitted only with the isolated Aureon local-test environment.');
  }
  if (publishableKey?.startsWith('pk_test_')) {
    throw new Error('Stripe test-mode publishable keys are permitted only with the isolated Aureon local-test environment.');
  }
}

export function assertWebhookMode(livemode: boolean, env: Environment = process.env) {
  const testMode = assertRuntimeIsolation(env);
  if (testMode && livemode) {
    throw new Error('Aureon local-test mode cannot process live Stripe events.');
  }
  if (!testMode && !livemode) {
    throw new Error('Test-mode Stripe events are accepted only by the isolated local-test environment.');
  }
}

export const LOCAL_TEST_PROJECT = LOCAL_TEST_PROJECT_ID;
