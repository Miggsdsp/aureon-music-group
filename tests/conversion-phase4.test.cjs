const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

test('homepage states the product and exposes one listening and one account CTA', () => {
  const hero = read('components/CinematicHero.tsx');
  assert.match(hero, /DISCOVER ORIGINAL MUSIC/);
  assert.match(hero, /six artists and distinct genres/);
  assert.match(hero, /href="\/discover">START LISTENING/);
  assert.match(hero, /href="\/account\?mode=signup">CREATE FREE ACCOUNT/);
});

test('public catalogue detail pages expose clear discovery and account paths', () => {
  const artist = read('app/artists/[slug]/CataloguePageClient.tsx');
  const song = read('app/songs/[slug]/CataloguePageClient.tsx');
  const album = read('app/music/[slug]/CataloguePageClient.tsx');
  assert.match(artist, /Listen now — latest release/);
  assert.match(artist, /href="#artist-releases">Explore releases/);
  assert.match(song, /Listen now — 40s preview/);
  assert.match(song, /More from \{artist\}/);
  assert.match(album, /href="#album-tracks">Listen to the album/);
  for (const source of [artist, song, album]) assert.match(source, /href="\/account\?mode=signup"/);
});

test('membership copy matches the five-action billing-cycle rule', () => {
  const membership = read('app/membership/page.tsx');
  assert.match(membership, /Exactly 5 high-quality licensed download actions per billing cycle/);
  assert.match(membership, /including re-downloads/);
  assert.doesNotMatch(membership, /Re-downloads of the same selected song do not use another monthly slot/);
});

test('account sign-up deep links open sign-up mode', () => {
  const account = read('app/account/page.tsx');
  assert.match(account, /params\.get\('mode'\)===\s*'signup'/);
  assert.match(account, /params\.has\('plan'\)/);
  assert.match(account, /setMode\('signup'\)/);
});
