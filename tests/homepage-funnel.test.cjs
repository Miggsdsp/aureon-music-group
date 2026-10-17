const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');

test('homepage explains Aureon and exposes listening before membership', () => {
  const hero = read('components/CinematicHero.tsx');
  assert.match(hero, /Discover original releases from independent artists/);
  assert.match(hero, /Preview songs, explore albums, and join Listener to hear the full catalogue/);
  assert.match(hero, /href="\/discover">START LISTENING/);
  assert.match(hero, /href="\/membership">EXPLORE MEMBERSHIP/);
  assert.doesNotMatch(hero, /across six artists/);
  assert.match(hero, /className=\{`hero approved-hero/);
  assert.match(hero, /<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop/);
});

test('preview completion offers optional inline choices without taking over the screen', () => {
  const player = read('components/LatestPlayButton.tsx');
  assert.match(player, /conversionPrompt=previewFinished&&!promotional/);
  assert.match(player, /className=\{styles\.conversionPrompt\}/);
  assert.match(player, /href="\/membership"[\s\S]*?trackConversion\('listener_membership'\)/);
  assert.match(player, /Replay the 40-second preview/);
  assert.doesNotMatch(player, /createPortal|aria-modal|conversionBackdrop|document\.body\.style\.overflow/);
  assert.doesNotMatch(player, /setNearEnd|benefitCue/);
});

test('preview, signup, and membership funnel events use the existing consent gate', () => {
  const player = read('components/LatestPlayButton.tsx');
  const account = read('app/account/page.tsx');
  const membership = read('app/membership/page.tsx');
  const tracker = read('lib/track-analytics.ts');
  const model = read('lib/analytics-model.ts');
  for (const event of ['music_preview_start', 'music_preview_progress', 'music_preview_complete', 'registration_start', 'membership_view']) {
    assert.match(model, new RegExp(`'${event}'`));
  }
  assert.match(player, /eventType:'music_preview_start'/);
  assert.match(player, /eventType:'music_preview_progress'/);
  assert.match(player, /eventType:'music_preview_complete'/);
  assert.match(account, /eventType:'registration_start'/);
  assert.match(membership, /eventType:'membership_view'/);
  assert.match(tracker, /!analyticsConsent\(\)/);
  assert.match(tracker, /!CLIENT_ANALYTICS_EVENTS\.includes\(event\.eventType\)/);
});
