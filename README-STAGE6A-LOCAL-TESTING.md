# Aureon isolated subscription testing

This setup runs the website against Firebase Auth, Firestore and Storage emulators, plus Stripe test mode. It does not use a Firebase cloud project or a Vercel environment. Firebase project ID `demo-aureon-music-group` is fixed in the CLI alias and in the app's test-mode checks.

Do not configure a live Stripe key, service account, or non-local emulator host in `.env.local-test`. The app rejects those combinations. Test mode also refuses to run on Vercel. Production and Preview environment variables are not changed by this setup.

## One-time local setup

Requirements: Node.js 20 or later, Java 11 or later, and Stripe CLI. On macOS, install the Stripe CLI with `brew install stripe/stripe-cli/stripe`, then authenticate with `stripe login`.

1. Install the locked dependencies with `npm ci`.
2. Copy `.env.local-test.example` to `.env.local-test`.
3. In the Stripe Dashboard, select Aureon Music Group and switch the **Test mode** toggle on. Open **Product catalogue → Products → Add product** and create two test-only products: `Aureon Listener — Stage 6A Test` and `Aureon Creator — Stage 6A Test`. For each, add a recurring monthly Price of €8.99 and €24.99 respectively. These are separate test records and do not change the live catalogue or live prices.
4. In **Developers → API keys** with Test mode still enabled, copy the publishable key (`pk_test_…`, public) and secret key (`sk_test_…`, secret). Copy each test Price ID (`price_…`, not secret) from its product page. Put them only in the ignored `.env.local-test` file as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_LISTENER_PRICE_ID` and `STRIPE_CREATOR_PRICE_ID`. Never put secret values in Git or chat. The app refuses `sk_live_…`/`pk_live_…` when local test mode is enabled.
5. Start Firebase emulators in one terminal:

   ```sh
   npm run emulators:local-test
   ```

   The Auth, Firestore, Storage and Emulator UI ports are 9099, 8080, 9199 and 4000. The Auth emulator prints email verification links in this terminal; it does not send real email.

6. Start the local Stripe webhook forwarder in a second terminal:

   ```sh
   npm run stripe:listen:local-test
   ```

   Sign in to Stripe CLI when prompted. This command forwards only to `localhost:3000/api/stripe/subscriptions`. Copy the displayed local signing secret (`whsec_…`, secret) into `STRIPE_SUBSCRIPTION_TEST_WEBHOOK_SECRET` in `.env.local-test`; never use a production webhook secret here. Restart the app after editing the file. The CLI secret is local to this forwarder and must not be added to Stripe's production webhook destination.

7. Start the app in a third terminal:

   ```sh
   npm run dev:local-test
   ```

8. Visit `http://localhost:3000`, register a test account, and open the verification URL printed by the Auth emulator. Return to the local site and continue with the selected plan. In Stripe Checkout use a Stripe test card such as `4242 4242 4242 4242`, a future expiry and any CVC. No real charge is made.

## Evidence to capture for each plan

- Firebase Emulator UI (`http://127.0.0.1:4000`): test user exists and `members/{uid}` has the expected `plan`, active status and Stripe test subscription ID.
- Stripe Dashboard in test mode: Checkout Session and Subscription are test-mode records, and the local CLI shows the signed webhook delivery succeeded.
- Local app `/account`: the expected Listener or Creator plan is active. Check full-track access for Listener and Creator licensing access for Creator.
- The browser must remain on `localhost`; never complete this test on the production domain.

Repeat with a second account for the other plan. Exercise cancellation and upgrades only against the test subscription. Use Stripe test clocks or test-mode Dashboard controls for lifecycle checks; do not trigger test events at the production domain.

## Commands

- `npm test` runs the repository test suite and environment-isolation tests.
- `npm run lint` runs Next.js ESLint non-interactively.
- `npm run build:local-test` starts the emulators, builds the app against the empty local Firestore database, and stops the emulators. This preserves the live sitemap's Firestore queries instead of skipping them.
- `npm run build` remains the production/Vercel build and still requires its normal server configuration. It is not redirected to local emulators.

The Firebase CLI defaults to the demo project on purpose. Do not run `firebase deploy` from this checkout. No separate Vercel test URL exists or is required for this local architecture.

## Owner setup completion check

- **Stripe Dashboard:** confirm the dashboard is in Test mode; confirm both Stage 6A products have monthly test Prices; confirm API keys show the `pk_test_` and `sk_test_` prefixes. Values belong in `.env.local-test` only; the secret key and webhook secret are secrets, the publishable key and Price IDs are not.
- **Stripe CLI:** `stripe listen` should report forwarding to `http://localhost:3000/api/stripe/subscriptions`. Its `whsec_…` secret belongs in `.env.local-test` only.
- **Firebase:** no cloud project or service-account key is needed. Confirm Emulator UI is at `http://127.0.0.1:4000`, and Auth/Firestore/Storage show local emulator connections. Verification links are read from the emulator terminal.
- **Vercel:** no custom environment, Preview variables, or Production variables are needed or changed. Do not use a Vercel URL for these tests.
