const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const page = fs.readFileSync('app/about/page.tsx', 'utf8');
const styles = fs.readFileSync('app/about/about.module.css', 'utf8');
const layout = fs.readFileSync('app/layout.tsx', 'utf8');

test('About page uses its scoped premium layout and retains its existing journeys', () => {
  assert.match(page, /import styles from '\.\/about\.module\.css'/);
  assert.match(page, /styles\.hero/);
  assert.match(page, /href="\/music"/);
  assert.match(page, /href="\/membership"/);
  assert.match(page, /href="\/contact"/);
  assert.match(page, /EditablePageText/);
  assert.doesNotMatch(page, /about-hero-clean|about-final-cta|page-shell about-page/);
});

test('About styling follows the compact cinematic system at desktop and mobile sizes', () => {
  assert.match(styles, /aureon-eclipse-ocean-poster\.webp/);
  assert.match(styles, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:600px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /text-wrap:balance/);
});

test('legacy About global overrides are no longer loaded on every route', () => {
  assert.doesNotMatch(layout, /\.\/about\.css|\.\/about-cleanup\.css/);
});
