const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const detail = read('app/library/playlists/[playlistId]/page.tsx');
const library = read('app/library/page.tsx');
const account = read('app/account/page.tsx');
const player = read('components/music/MusicPlayerProvider.tsx');
const css = read('app/library/playlists/[playlistId]/playlist-detail.module.css');
const utils = read('lib/playlist-utils.ts');

test('playlist detail is scoped to the signed-in member and active membership', () => {
  assert.match(detail, /doc\(firestore, 'members', user\.uid, 'playlists', playlistId\)/);
  assert.match(detail, /\['active', 'trialing'\]/);
  assert.match(detail, /where\('status', '==', 'published'\)/);
  assert.match(detail, /useMusicPlayer\(\)/);
});

test('playlist page uses existing protected playlist APIs and owner scoped edits', () => {
  assert.match(detail, /\/api\/member\/playlists\/\$\{encodeURIComponent\(playlist\.id\)\}\/songs/);
  assert.match(detail, /\/api\/member\/playlist-image/);
  assert.match(detail, /members', user\.uid, 'playlists', playlist\.id/);
  assert.match(detail, /deleteDoc\(doc\(firestore, 'members', user\.uid, 'playlists', playlist\.id\)\)/);
});

test('playlist experience connects to the persistent player and Up Next queue', () => {
  assert.match(detail, /playQueue\(playlistSongs\)/);
  assert.match(detail, /playQueue\(shufflePlaylist\(playlistSongs\)\)/);
  assert.match(detail, /playSong\(song, songs, index\)/);
  assert.match(detail, /enqueue\(song\)/);
  assert.match(detail, /openQueue/);
  assert.match(player, /openQueue: \(\) => void/);
  assert.match(player, /setQueueOpen\(true\)/);
});

test('library links existing playlist cards to the dedicated detail page', () => {
  assert.match(library, /href=\{`\/library\/playlists\/\$\{encodeURIComponent\(playlist\.id\)\}`\}/);
});

test('login safely returns authenticated members to the requested playlist', () => {
  assert.match(account, /get\('next'\)/);
  assert.match(account, /next\.startsWith\('\/library\/playlists\/'\)/);
});

test('playlist helpers provide non-mutating shuffle and readable duration', () => {
  assert.match(utils, /const shuffled = \[\.\.\.items\]/);
  assert.match(utils, /Math\.floor\(random\(\) \* \(index \+ 1\)\)/);
  assert.match(utils, /Duration unavailable/);
  assert.match(utils, /hr .* min/);
});

test('playlist presentation provides mobile layout, artwork, active track and management controls', () => {
  for (const content of ['Play All', 'Shuffle', 'Add tracks', 'Change artwork', 'Rename', 'Delete playlist', 'Up Next', 'albumTitle', 'durationLabel']) {
    assert.ok(detail.includes(content), `expected playlist UI to include ${content}`);
  }
  assert.match(detail, /currentTrack/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
