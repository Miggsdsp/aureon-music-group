# Aureon Music Group — Phase 1 Baseline

Stable visual baseline commit before the Phase 1 audit:

`5495173deaa4dde016f6d88929a07f6a8b32c10e`

This commit can be used to restore the site if a later change needs to be rolled back.

## Frozen public routes

- `/`
- `/artists`
- `/artists/[slug]`
- `/music`
- `/music/[slug]`
- `/videos`
- `/videos/[slug]`
- `/news`
- `/news/[slug]`
- `/merchandise`
- `/merchandise/[slug]`
- `/about`
- `/contact`
- `/checkout`

After Phase 1, new catalogue content must not be added directly to hardcoded data files. New content will be managed through the future authenticated backend.
