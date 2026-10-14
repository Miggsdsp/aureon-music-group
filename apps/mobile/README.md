# Aureon Mobile — Phase 1 foundation

Isolated Expo Router application for iOS and Android. No production website files or payment flows are modified.

## Local or remote setup

1. Use Node.js compatible with Expo SDK 54.
2. `cd apps/mobile && npm install`
3. Copy `.env.example` to `.env` and fill with the existing Firebase **web-client** configuration (never admin credentials).
4. `npx expo install --check` and `npm run typecheck`.
5. `npm start` for Metro; EAS cloud builds can be configured after Expo account, bundle IDs and signing are approved.

## Safety boundaries

- Login screen is a placeholder; no authentication has been verified.
- `src/config/firebase.ts` is configuration scaffolding only; auth persistence and account login belong to Phase 2.
- Music playback, API entitlement enforcement, account deletion and subscriptions are not implemented yet.
- No production deployment should be triggered by this branch.
- Verify Vercel root directory/build settings before merging; keep root Next.js build unchanged.
- Website-only subscription model; app must not display prohibited purchase calls to action.
