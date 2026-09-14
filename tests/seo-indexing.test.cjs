const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(path, imports = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in imports ? imports[name] : require(name), process, Date, console, Headers, ...globals }, { filename: path });
  return module.exports;
}
const artistIdentity = load('lib/artist-identity.ts');
const content = load('lib/public-content.ts', { '@/lib/artist-identity': artistIdentity });
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
    const layout = load(`app/${route}/[slug]/layout.tsx`, { 'next/navigation': { notFound }, '@/lib/seo': { getPublishedRecord: async () => null }, '@/lib/schema': {}, '@/lib/public-catalogue': {}, '@/lib/get-preview-url': {}, '@/lib/artist-identity': artistIdentity });
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
  const seo = load('lib/seo.ts', { react:{cache:fn=>fn}, '@/lib/firebase-admin':{adminFirestore:db}, '@/lib/public-content':content, '@/lib/artist-identity':artistIdentity });
  assert.equal((await seo.getPublishedRecord('songs','ok')).slug,'ok');
  direct = { status:'published',publishAt:'2999-01-01' };
  assert.equal(await seo.getPublishedRecord('songs','future'),null);
  direct = null; bySlug = { status:'published',slug:'ok' };
  assert.equal((await seo.getPublishedRecord('songs','ok')).id,'slug-id');
  bySlug = { status:'published', id:'forged-id', slug:'ok', details:{title:'Legacy title'} };
  const records = await seo.getPublishedRecords('songs');
  assert.equal(records[0].id,'slug-id');
  assert.equal(records[0].title,'Legacy title');
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

const catalogue = load('lib/public-catalogue.ts', {
 './recommendations': load('lib/recommendations.ts'), './public-content': content, './get-artwork': load('lib/get-artwork.ts'), './get-preview-url': load('lib/get-preview-url.ts')
});
test('public normalization keeps authoritative top-level values, nested fallbacks and document identity', () => {
 const record = content.normalizePublicRecord({title:'Published title', price:0, promotional:false, details:{id:'forged',title:'Old title',price:1, promotional:true,description:'Story'}}, 'real-id');
 assert.equal(record.id,'real-id'); assert.equal(record.title,'Published title'); assert.equal(record.details.title,record.title);
 assert.equal(record.price,0); assert.equal(record.promotional,false); assert.equal(record.description,'Story');
 const legacy = content.normalizePublicRecord({details:{slug:'not-a-top-level-slug'}}, 'document-id');
 assert.equal(legacy.slug,'document-id'); assert.equal(legacy.details.slug,legacy.slug);
});
test('server catalogue payload whitelists display fields and public preview assets', () => {
 const record = catalogue.publicCatalogueRecord({id:'song',status:'published',title:'Song',details:{description:'Story',previewUrl:'/public/previews/song.wav',releaseDate:{seconds:0},fullTrackUrl:'private/full-tracks/master.wav'},streamUrl:'private/streams/song.aac',downloadToken:'secret',previewAudioUrl:'/private/master.wav'},true);
 assert.equal(record.description,'Story'); assert.equal(record.previewUrl,'/public/previews/song.wav');
 assert.equal(record.releaseDate,'1970-01-01T00:00:00.000Z');
 assert.equal(record.downloadToken,undefined); assert.equal(record.streamUrl,undefined); assert.equal(record.details,undefined);
 for(const url of ['/private/full-tracks/song.wav','https://storage.example/private%2Fstreams%2Fsong.aac','/api/download/token','/api/member/audio/song']) assert.equal(catalogue.publicAsset(url),'');
});
test('public catalogue resolves legacy references, excludes scheduled/private records and avoids empty album matches', () => {
 const records = catalogue.makePublicCatalogue({artists:[{id:'artist-doc',status:'published',name:'Artist',slug:'artist-route'}],albums:[{id:'album-doc',status:'published',title:'Album',slug:'album-route',artistId:'artist-doc'}],songs:[{id:'song',status:'published',details:{artistId:'artist-doc',albumId:'album-doc'}},{id:'future',status:'published',details:{releaseDate:'2999-01-01'}},{id:'private',status:'published',isPrivate:true}]});
 assert.equal(records.songs.length,1); assert.equal(records.songs[0].artistSlug,'artist-route'); assert.equal(records.songs[0].albumSlug,'album-route');
 assert.equal(catalogue.matchesAlbum({},{}),false);
});

test('initial view payloads preserve tracks and links while bounding unused song assets', () => {
 const songs = Array.from({length:120},(_,i)=>({id:String(i),status:'published',title:'Song '+i,slug:'song-'+i,albumId:'album',artistId:'artist',previewUrl:'/public/previews/'+i+'.wav',trackNumber:i}));
 const records = {artists:[],albums:[{id:'album',slug:'album',title:'Album'}],songs};
 assert.equal(catalogue.initialCatalogueFor(records,'songs',songs[0]).songs.length,9);
 assert.ok(catalogue.initialCatalogueFor(records,'discover').songs.length<=17);
 const hub = catalogue.initialCatalogueFor(records,'music');
 assert.equal(hub.songs.length,120); assert.equal(hub.songs[6].previewUrl,undefined);
 assert.equal(catalogue.initialCatalogueFor(records,'albums',records.albums[0]).songs.length,120);
});

test('initial footer playlist markup is identical across server and browser time zones', () => {
 const React = require('react'); const {renderToStaticMarkup} = require('react-dom/server');
 const imports = {
  'next/link': {default:props=>React.createElement('a',props)}, 'next/navigation':{usePathname:()=>'/songs/test'},
  'firebase/auth':{}, '@/components/ArtworkImage':{}, '@/components/LatestPlayButton':{}, '@/lib/firebase-client':{},
  '@/lib/get-artwork':{}, '@/lib/get-preview-url':{}, '@/lib/recommendations':{recommendSongs:()=>[],recommendArtists:()=>[],recommendAlbums:()=>[]},
  '@/lib/use-published-collection':{usePublishedCollection:()=>({items:[]})}, './InfiniteDiscovery.module.css':{default:{}}
 };
 const render = hour => { class Clock extends Date {getHours(){return hour}}; const module=load('components/discovery/InfiniteDiscovery.tsx',imports,{Date:Clock});return renderToStaticMarkup(React.createElement(module.InfiniteDiscovery)); };
 assert.equal(render(5),render(13));
});
test('client slug lookup survives denied direct document reads and keeps server normalization', async () => {
 const effects=[]; const states=[];
 const react={useEffect:fn=>effects.push(fn),useState:value=>{const i=states.length;states.push(value);return[value,v=>{states[i]=v}];}};
 const db={collection:()=>({}),doc:()=>({}),where:()=>({}),limit:()=>({}),query:()=>({}),getDoc:async()=>{throw Object.assign(Error('Document read denied'),{code:'permission-denied'})},getDocs:async()=>({empty:false,docs:[{id:'real-id',data:()=>({status:'published',slug:'song-route',title:'Current',details:{title:'Old',description:'Story'}})}]})};
 const hook=load('lib/usePublishedDocument.ts', {react,'firebase/firestore':db,'@/lib/firebase-client':{firestore:{}},'@/components/catalogue/PublicCatalogueProvider':{useInitialPublicCatalogue:()=>null},'@/lib/public-content':content});
 hook.usePublishedDocument('songs','song-route',null);effects[0]();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(states[0]?.id,'real-id');assert.equal(states[0]?.title,'Current');assert.equal(states[0]?.description,'Story');assert.equal(states[1],false);
});

test('seeded client refresh uses the authoritative server document ID', async () => {
 const effects=[]; const states=[];let readId='';
 const seed={id:'authoritative-id',slug:'public-slug',status:'published',title:'Server title'};
 const react={useEffect:fn=>effects.push(fn),useState:value=>{const i=states.length;states.push(value);return[value,v=>{states[i]=v}];}};
 const db={doc:(_db,_collection,id)=>{readId=id;return{}},getDoc:async()=>({exists:()=>true,id:seed.id,data:()=>({...seed,title:'Updated title'})})};
 const hook=load('lib/usePublishedDocument.ts', {react,'firebase/firestore':db,'@/lib/firebase-client':{firestore:{}},'@/components/catalogue/PublicCatalogueProvider':{useInitialPublicCatalogue:()=>({songs:[seed]})},'@/lib/public-content':content});
 hook.usePublishedDocument('songs','public-slug',null);effects[0]();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(readId,'authoritative-id');assert.equal(states[0].id,seed.id);assert.equal(states[0].title,'Updated title');
});
