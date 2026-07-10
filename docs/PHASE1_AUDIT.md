# Phase 1 Website Audit

Status: **Complete — stable public-site baseline established**

## Route inventory

- Home: `/`
- Artists: `/artists`
- Artist profiles: `/artists/[slug]`
- Music: `/music`
- Album pages: `/music/[slug]`
- Videos: `/videos`
- Video album pages: `/videos/[slug]`
- News: `/news`
- News articles: `/news/[slug]`
- Merchandise: `/merchandise`
- Product pages: `/merchandise/[slug]`
- About: `/about`
- Contact: `/contact`
- Checkout: `/checkout`

## Phase 1 corrections

- Removed public upload instructions from the Music page.
- Removed the public `Upload song file` error message.
- Failed or unavailable audio previews now remain hidden rather than exposing internal setup instructions.
- Removed the public master-file path from cart records.
- Replaced the checkout placeholder with customer, billing, delivery and order-detail fields.
- Added responsive checkout, catalogue, header and footer refinements for desktop, tablet and mobile.
- Confirmed shared internal-page structure through `Header`, `PageShell` and `Footer` components.
- Preserved the homepage's integrated four-panel footer design as the visual reference for the shared footer.

## Content freeze

The following hardcoded files are now frozen as temporary migration data only:

- `data/artists.ts`
- `data/albums.ts`
- `data/videoAlbums.ts`
- `data/news.ts`
- `data/products.ts`

Do not add new catalogue records to these files. Future artists, releases, videos, products and articles must be created through the authenticated backend.

## Baseline recovery

Pre-audit visual baseline commit:

`5495173deaa4dde016f6d88929a07f6a8b32c10e`

The repository connector used for this audit does not provide branch-creation access, so the baseline commit is recorded as the rollback point instead of creating a separate backup branch.
