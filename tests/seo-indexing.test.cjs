const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(path, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in imports ? imports[name] : require(name), process, Date, console, Headers }, { filename: path });
  return module.exports;
}
const content = load('lib/public-content.ts');
const locales = load('lib/i18n/config.ts');
const policy = load('lib/index-policy.ts', { '@/lib/i18n/config': locales });

test('publication eligibility excludes private, unpublished, future and malformed schedules', () => {
  const now = Date.parse('2026-09-14T12:00:00Z');
  const visible = { status: 'published', slug: 'valid' };
  assert.equal(content.isPublicContent(visible, now), true);
  for (const patch of [{ status: 'draft' }, { status: 'scheduled' }, { isPublic: false }, { isPrivate: true }, { visibility: 'private' }, { visibility: 'unlisted' }]) {
    assert.equal(content.isPublicContent({ ...visible, ...patch }, now), false);
  }
  for (const key of ['publishAt', 'scheduledAt', 'releaseDate']) {
    for (const value of ['2026-09-15T00:00:00Z', { seconds: 1789430400 }, { toDate: () => new Date('2026-09-15') }, 'invalid']) {
      assert.equal(content.isPublicContent({ ...visible, [key]: value }, now), false);
      assert.equal(content.isPublicContent({ ...visible, details: { [key]: value } }, now), false);
    }
    assert.equal(content.isPublicContent({ ...visible, [key]: '2026-09-01' }, now), true);
  }
  assert.equal(content.isPublicContent({ ...visible, details: { isPublic: false } }, now), false);
});

test('lastModified uses stored dates and omits missing or invalid values', () => {
  assert.equal(content.contentLastModified({}), undefined);
  assert.equal(content.contentLastModified({ updatedAt: 'bad' }), undefined);
  assert.equal(content.contentLastModified({ updatedAt: 'bad', createdAt: '2026-09-01' }).toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(content.contentDate({ seconds: 0 }).toISOString(), '1970-01-01T00:00:00.000Z');
});

test('private/search policy covers bare, nested, dotted and all supported locale paths', () => {
  for (const prefix of ['', ...locales.locales.map(locale => '/' + locale)]) {
    for (const root of ['/account','/library','/checkout','/admin','/api','/search']) {
      for (const suffix of ['', '/', '/nested', '/download/file.wav']) assert.equal(policy.shouldNoIndex(prefix + root + suffix), true);
    }
    for (const path of ['/','/artists','/music','/songs/dust-on-my-boots','/genres/all','/administrator','/searching','/sitemap.xml']) assert.equal(policy.shouldNoIndex(prefix + path), false);
  }
});

test('sitemap includes only eligible slugged songs, canonical host, deduplication and honest dates', async () => {
  const records = [{ status:'published', slug:'live', updatedAt:'2026-09-01' }, { status:'published', slug:'live' }, { status:'draft',slug:'draft' }, { status:'published',slug:'private',isPublic:false }, { status:'published',slug:'future',publishAt:'2999-01-01' }, { status:'published',id:'without-slug' }];
  const sitemap = load('app/sitemap.ts', { '@/lib/seo': { getPublishedRecords: async name => name === 'songs' ? records.filter(x => content.isPublicContent(x)) : [] }, '@/lib/public-content':content });
  const rows = await sitemap.default();
  const songs = rows.filter(x => x.url.includes('/songs/'));
  assert.deepEqual(Array.from(songs, x => x.url), ['https://www.aureonmusicgroup.com/songs/live']);
  assert.equal(rows[0].lastModified, undefined);
  assert.equal(songs[0].lastModified.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(rows.some(x => /localhost|future|private|draft/.test(x.url)), false);
});

test('genre allowlist preserves core and actual catalogue genres without arbitrary pages', async () => {
  const genres = load('lib/public-genres.ts', { '@/lib/seo': { getPublishedRecords: async () => [{ genre:'Afro-Beats' }, { details:{genre:'Modern Country-Pop'} }] } });
  for (const slug of ['all','country-pop','afrobeats','deep-house','latin-pop','reggae','modern-pop','afro-beats','modern-country-pop']) assert.notEqual(await genres.getPublicGenre(slug), null);
  for (const slug of ['invented-genre','__proto__','constructor','../country-pop','']) assert.equal(await genres.getPublicGenre(slug), null);
});

test('missing artist, song and album records call Next notFound in metadata and layout', async () => {
  for (const route of ['artists','songs','music']) {
    const notFound = () => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404'); };
    const layout = load(`app/${route}/[slug]/layout.tsx`, { 'next/navigation': { notFound }, '@/lib/seo': { getPublishedRecord: async () => null }, '@/lib/schema': {} });
    const props = { params:Promise.resolve({slug:'missing'}), children:null };
    await assert.rejects(layout.generateMetadata(props), /;404/);
    await assert.rejects(layout.default(props), /;404/);
  }
});

test('SEO record lookup filters direct IDs and slug results without swallowing database errors', async () => {
  let direct = { status:'published', slug:'ok' };
  let bySlug = null;
  const chain = { where: () => chain, limit: () => chain, get: async () => ({ empty:!bySlug, docs: bySlug ? [{id:'slug-id',data:()=>bySlug}] : [] }) };
  const db = { collection: () => ({ ...chain, doc: () => ({ get: async () => ({ exists:!!direct, id:'direct-id', data:()=>direct }) }) }) };
  const seo = load('lib/seo.ts', { react:{cache:fn=>fn}, '@/lib/firebase-admin':{adminFirestore:db}, '@/lib/public-content':content });
  assert.equal((await seo.getPublishedRecord('songs','ok')).slug,'ok');
  direct = { status:'published',publishAt:'2999-01-01' };
  assert.equal(await seo.getPublishedRecord('songs','future'),null);
  direct = null; bySlug = { status:'published',slug:'ok' };
  assert.equal((await seo.getPublishedRecord('songs','ok')).id,'slug-id');
  bySlug = { status:'published',isPublic:false };
  assert.equal(await seo.getPublishedRecord('songs','private'),null);
  db.collection = () => {throw Error('database unavailable')};
  await assert.rejects(seo.getPublishedRecord('songs','ok'), /database unavailable/);
});

test('middleware sets noindex on API early returns and locale rewrites while preserving routing', () => {
  const { NextRequest, NextResponse } = require('next/server');
  const middleware = load('middleware.ts', { 'next/server':{NextRequest,NextResponse}, '@/lib/i18n/config':locales, '@/lib/index-policy':policy }).middleware;
  for (const path of ['/admin','/admin/login','/api/download/file.wav','/checkout/success?session_id=test','/en/account','/pt/admin','/de/search?q=test','/fr/api/member/access']) {
    const response = middleware(new NextRequest('https://www.aureonmusicgroup.com'+path));
    assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow',path);
  }
  const translated = middleware(new NextRequest('https://www.aureonmusicgroup.com/pt/account?tab=profile'));
  assert.equal(translated.headers.get('x-middleware-rewrite'),'https://www.aureonmusicgroup.com/account?tab=profile');
  for (const path of ['/','/artists','/songs/live','/sitemap.xml','/robots.txt']) {
    assert.equal(middleware(new NextRequest('https://www.aureonmusicgroup.com'+path)).headers.get('x-robots-tag'),null,path);
  }
});

test('genre server layout rejects missing genres before rendering children', async () => {
  const layout = load('app/genres/[slug]/layout.tsx', {
    'next/navigation': { notFound: () => { throw Error('NEXT_HTTP_ERROR_FALLBACK;404'); } },
    '@/lib/public-genres': { getPublicGenre: async slug => slug === 'all' ? '' : null },
  });
  await assert.rejects(layout.default({ params:Promise.resolve({slug:'missing'}), children:'content' }), /;404/);
  await assert.rejects(layout.generateMetadata({ params:Promise.resolve({slug:'missing'}) }), /;404/);
  assert.equal(await layout.default({ params:Promise.resolve({slug:'all'}), children:'content' }), 'content');
});
