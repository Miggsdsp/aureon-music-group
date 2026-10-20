const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('homepage keeps the cinematic hero and places live artist discovery beneath it', () => {
  const page = read('app/page.tsx');
  assert.match(page, /<CinematicHero\s*\/>/);
  assert.match(page, /<CinematicHero\s*\/>\s*<HomeArtistRotation\s*\/>/);
  assert.match(page, /<HomeMembershipCta\s*\/>/);
  assert.match(page, /initialCatalogueFor\(catalogue, 'discover'\)/);
});

test('featured artists use published catalogue records and mount only once', () => {
  const page = read('app/page.tsx');
  const deferred = read('components/HomeFeaturedContent.tsx');
  const artists = read('components/HomeArtistRotation.tsx');
  assert.equal((page.match(/<HomeArtistRotation\s*\/>/g) || []).length, 1);
  assert.doesNotMatch(deferred, /HomeArtistRotation/);
  assert.match(artists, /usePublishedCollection<Artist>\('artists'/);
  assert.match(artists, /artist\.profileImageUrl \|\| artist\.logoUrl/);
});

test('homepage curated sections do not repeat the infinite discovery feed on the root route', () => {
  const discovery = read('components/discovery/InfiniteDiscovery.tsx');
  const predicate = discovery.match(/const PUBLIC_CONTENT = [^;]+;/)?.[0] || '';
  assert.match(discovery, /homepage composes its own curated discovery sections/);
  assert.equal(predicate.includes("^\\/$|"), false);
  assert.match(predicate, /artists\|music\|songs\|videos/);
});

test('membership invitation uses existing public routes without introducing new plan claims', () => {
  const cta = read('components/HomeMembershipCta.tsx');
  assert.match(cta, /href="\/membership"/);
  assert.match(cta, /href="\/music"/);
  assert.doesNotMatch(cta, /free trial|limited time|only \d+ left/i);
});
