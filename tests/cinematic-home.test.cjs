const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('cinematic homepage preserves the configured video and has a local branded fallback', () => {
  const hero = fs.readFileSync('components/CinematicHero.tsx', 'utf8');
  const css = fs.readFileSync('components/CinematicHero.module.css', 'utf8');
  assert.match(hero, /siteSettings', 'platform'/);
  assert.match(hero, /autoPlay[\s\S]*muted[\s\S]*loop[\s\S]*playsInline/);
  assert.match(hero, /poster="\/images\/aureon-eclipse-ocean-poster\.webp"/);
  assert.match(hero, /onError=\{\(\) => \{ setVideoFailed\(true\)/);
  assert.match(css, /aureon-eclipse-ocean-poster\.webp/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok(fs.statSync('public/images/aureon-eclipse-ocean-poster.webp').size < 250_000);
});

test('public pages do not import obsolete full-screen homepage screenshot overrides', () => {
  const layout = fs.readFileSync('app/layout.tsx', 'utf8');
  assert.doesNotMatch(layout, /finish\.css|sprint2\.css|homepage-fit-fix\.css/);
  assert.doesNotMatch(fs.readFileSync('app/home-media-override.css', 'utf8'), /approved-hero|homepage-finish\.png/);
});
