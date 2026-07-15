# Aureon Music Group — CMS and Launch Readiness Audit

Date: 15 July 2026

## Objective
Make Firestore and Firebase Storage the operational source of truth so Aureon can manage artists, albums, songs, videos, news, products, pages and settings without editing code.

## Changes completed in this pass

- Artist profile pages now read published songs from Firestore and show all assigned songs.
- Music catalogue now reads albums from Firestore and also shows published singles with no album.
- Album pages merge uploaded Firestore songs with legacy release data and support additional tracks.
- Song uploads store the full master privately and create a public 40-second preview.
- Header navigation labels, links and logo can be controlled through the published `sitePages/header` document.
- Footer text, links and social URLs can be controlled through the published `sitePages/footer` document.
- Footer latest release is selected from published Firestore songs rather than a fixed Solara record.
- Merchandise visibility remains controlled by the site feature switch.
- Stripe Checkout, webhook processing, order email and one-use download entitlements are operational.

## CMS documents to create

### `sitePages/header`
Recommended fields:
- `status: published`
- `logoUrl`
- `logoAlt`
- `homeLabel`, `homeHref`
- `artistsLabel`, `artistsHref`
- `musicLabel`, `musicHref`
- `videosLabel`, `videosHref`
- `newsLabel`, `newsHref`
- `merchLabel`, `merchHref`
- `aboutLabel`, `aboutHref`
- `contactLabel`, `contactHref`
- `listenLabel`

### `sitePages/footer`
Recommended fields:
- `status: published`
- `missionTitle`, `missionText`, `missionHref`
- `latestTitle`
- `journeyTitle`, `journeyText`, `journeyHref`
- `followTitle`
- `spotifyUrl`, `youtubeUrl`, `instagramUrl`, `tiktokUrl`, `appleMusicUrl`
- `copyright`

## Remaining launch blockers

### Critical
1. Run a full production build and repair any TypeScript/build errors.
2. Confirm every newly uploaded song creates both `privateFilePath` and `previewUrl` in Firestore.
3. Confirm Firestore and Storage production rules are deployed and admin access works after a fresh login.
4. Replace legacy fallback catalogue data by creating matching Firestore artist, album, news and video records.
5. Complete legal policies and link them at checkout.
6. Complete contact form storage, notification, spam protection and admin enquiries.
7. Verify one-use download behaviour with real uploaded masters and failed/retry scenarios.

### High priority
1. Dedicated artist form fields: biography, social links, profile image, banner, latest release and SEO.
2. Dedicated album form fields and reliable album-song ordering.
3. Dedicated video form with artist relation, hosted video or external URL, duration and thumbnail.
4. Merchandise variants, inventory, shipping and tax workflow before enabling the store.
5. Orders module actions: resend email, regenerate entitlement, refund status and customer history.
6. Customer management screen.
7. Dynamic About, Contact, legal pages and homepage overlays from `sitePages`.
8. Dynamic SEO metadata, Open Graph images, sitemap, robots and structured data.

### Production hardening
1. Firebase App Check.
2. API rate limiting for checkout, webhook-adjacent endpoints and contact forms.
3. Server-side payload validation.
4. Error monitoring and structured server logs.
5. Firestore backup policy and separate development/production Firebase projects.
6. Dependency vulnerability review without forced breaking upgrades.
7. Admin `noindex` verification.
8. Accessibility, keyboard, contrast and image-alt audit.
9. Mobile Safari, Chrome, Edge and tablet testing.
10. Performance review for large audio/video uploads and long catalogues.

## Current readiness estimate

- Public visual website: 88%
- CMS content management: 78%
- Music upload and catalogue connection: 82%
- Stripe/order/download flow: 90%
- Video workflow: 50%
- Merchandise operations: 35%
- Legal/GDPR: 35%
- SEO/accessibility/performance: 55%
- Overall commercial launch readiness: approximately 72%

## Required verification sequence

1. Pull the latest code.
2. Run `npm run build`.
3. Run `npm run dev`.
4. Create or publish a Firestore artist.
5. Upload a song for that artist through the backend.
6. Confirm the full master appears under `private/full-tracks/<artist-slug>/`.
7. Confirm the preview appears under `public/previews/<artist-slug>/`.
8. Confirm the Firestore song document contains `artistId`, `artistSlug`, `privateFilePath`, `previewUrl`, `status: published` and price.
9. Confirm the song appears on the artist page and Music page.
10. Play the preview and verify it ends at 40 seconds.
11. Complete a Stripe sandbox purchase.
12. Confirm order, customer, payment/download entitlement and email delivery.
13. Download once and verify the second attempt is rejected.

## Launch verdict

The platform is now materially closer to being backend-operated, but it should not be moved to live Stripe payments until the critical verification sequence passes and the legal/contact/security items above are completed.
