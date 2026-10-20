const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in imports ? imports[name] : require(name) }, { filename: file });
  return module.exports;
}

const genres = load('lib/public-genres.ts', { react: { cache: fn => fn } });
const genreCatalogue = load('lib/genre-catalogue.ts', {
  '@/lib/get-artwork': { getArtwork: (record, fallback = '') => record?.coverImageUrl || record?.profileImageUrl || record?.logoUrl || fallback },
  '@/lib/public-catalogue': {
    publicAsset: value => String(value || '').includes('/private/') ? '' : String(value || ''),
    matchesAlbum: (song, album) => song.albumId === album.id,
    matchesArtist: (song, artist) => song.artistId === artist.id,
  },
  '@/lib/public-content': { isPublicContent: record => record.status === 'published' && record.isPublic !== false && record.isPrivate !== true },
  '@/lib/public-genres': genres,
});

test('genre directory counts distinct published songs in the existing Aureon genre allowlist', () => {
  assert.equal(genres.genreMatches('modern country-pop', 'Country-Pop'), true);
  assert.equal(genres.genreMatches('Afro-beat', 'Afrobeats'), true);
  assert.equal(genres.genreMatches('Alternative Rock', 'Country-Pop'), false);
  const rows = genreCatalogue.buildGenreCatalogue([
    { id: 'country-1', status: 'published', genre: 'Country', coverImageUrl: '/art/country.jpg' },
    { id: 'country-1', status: 'published', genres: ['Country-Pop'] },
    { id: 'country-2', status: 'published', genres: ['Country-Pop', 'Deep House'] },
    { id: 'private', status: 'published', genre: 'Country-Pop', isPrivate: true },
    { id: 'draft', status: 'draft', genre: 'Deep House' },
    { id: 'uncontrolled', status: 'published', genre: 'Alternative Rock' },
  ]);
  const country = rows.find(row => row.slug === 'country-pop');
  const deepHouse = rows.find(row => row.slug === 'deep-house');
  assert.equal(country.trackCount, 2);
  assert.equal(country.artwork, '/art/country.jpg');
  assert.equal(deepHouse.trackCount, 1);
  assert.equal(rows.some(row => row.slug === 'modern-pop'), false);
  assert.equal(rows.some(row => row.label === 'Alternative Rock'), false);
});

test('artist directory prioritises published portraits and links to existing artist and genre routes', () => {
  const page = fs.readFileSync('app/artists/CataloguePageClient.tsx', 'utf8');
  assert.match(page, /artist\.profileImageUrl \|\| artist\.image/);
  assert.match(page, /albums\.find\(album => matchesArtist\(album, artist\)\)/);
  assert.match(page, /portrait \|\| releaseArtwork \|\| artist\.logoUrl/);
  assert.match(page, /href=\{`\/artists\/\$\{artist\.slug\}`\}/);
  assert.match(page, /href="\/genres"/);
  assert.match(page, /Search artists or genres/);
});

test('genre directory exposes catalogue search and count-based sorting without placeholder tracks', () => {
  const directory = fs.readFileSync('app/genres/GenreDirectory.tsx', 'utf8');
  const page = fs.readFileSync('app/genres/page.tsx', 'utf8');
  const releases = fs.readFileSync('components/discovery/NewReleases.tsx', 'utf8');
  assert.match(directory, /Search genres/);
  assert.match(directory, /Most tracks/);
  assert.match(directory, /genre\.trackCount/);
  assert.match(page, /getPublishedRecords\('songs'\)/);
  assert.match(page, /buildGenreCatalogue\(songs, albums, artists\)/);
  assert.match(page, /path: '\/genres'/);
  assert.equal((releases.match(/genreMatches\(item\.genre,/g) || []).length, 2);
});
