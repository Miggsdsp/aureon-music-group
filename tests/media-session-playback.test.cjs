const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function runtime({ rejectArtwork = false } = {}) {
  const pageListeners = new Map();
  const on = (event, callback) => { if (!pageListeners.has(event)) pageListeners.set(event,new Set()); pageListeners.get(event).add(callback); };
  const fire = event => { for (const callback of pageListeners.get(event) || []) callback(); };
  const audios = [], buttons = [], effects = [], handlers = new Map();
  const session = { metadata: null, playbackState: 'none', setActionHandler(action, handler) { handlers.set(action, handler); } };
  class Audio {
    constructor() { this.paused = true; this.currentTime = 0; this.duration = 100; this.attributes = {}; this.style = {}; this.listeners = new Map(); this.loads = 0; }
    set src(value) { this.source = new URL(value, 'https://www.aureonmusicgroup.com').href; this.currentTime = 0; }
    get src() { return this.source || ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, fn) { if (!this.listeners.has(key)) this.listeners.set(key, new Set()); this.listeners.get(key).add(fn); }
    removeEventListener(key, fn) { this.listeners.get(key)?.delete(fn); }
    emit(key) { this['on' + key]?.(); for (const fn of this.listeners.get(key) || []) fn(); }
    load() { this.loads++; }
    pause() { if (this.paused) return; this.paused = true; this.emit('pause'); }
    async play() { this.paused = false; this.emit('play'); this.emit('playing'); }
  }
  const member = new Audio(); member.setAttribute('data-aureon-member-audio', 'true'); audios.push(member);
  const document = {
    visibilityState: 'visible', addEventListener: on,
    body: { style: {}, appendChild(audio) { audio.isConnected = true; if (!audios.includes(audio)) audios.push(audio); } },
    querySelector() { return member; },
    querySelectorAll(selector) { return selector.startsWith('[data-aureon-preview-button') ? buttons : audios; },
  };
  const react = { useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect: effect => effects.push(effect) };
  const jsx = (type, props) => ({ type, props });
  let player = { currentSong: null, isPlaying: false, toggle: async () => member.paused ? member.play() : member.pause(), next() {}, previous() {}, seekTo() {} };
  const modules = new Map();
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-dom': { createPortal: jsx }, 'next/link': { default: 'a' },
    'firebase/auth': { onAuthStateChanged: () => () => {} }, 'lucide-react': {},
    '@/lib/firebase-client': { firebaseAuth: { currentUser: null } },
    '@/lib/track-analytics': { trackAnalytics() {} }, '@/lib/discovery-analytics': { trackDiscovery() {} },
    '@/lib/get-preview-url': { getPreviewUrl: song => `/api/preview/${song.id}` },
    '@/lib/get-artwork': { DEFAULT_ARTWORK: '/cover.png', getArtwork: song => song.imageUrl },
    './MusicPlayerProvider': { useMusicPlayer: () => player },
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const requireMock = name => name === '@/lib/media-session-owner' || name === './media-session-owner' ? load('lib/media-session-owner.ts') : name === '@/lib/media-session-metadata' ? load('lib/media-session-metadata.ts') : name === '@/components/LatestPlayButton' ? load('components/LatestPlayButton.tsx') : name.endsWith('.css') ? {} : mocks[name] || {};
    vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, document, Audio, navigator: { mediaSession: session }, MediaMetadata: class { constructor(data) { if (rejectArtwork && data.artwork?.length) throw new TypeError('Artwork rejected'); this.imageList = data.artwork || []; Object.assign(this, Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'artwork'))); } get artwork() { return this.imageList; } }, window: { addEventListener: on, location: { origin: 'https://www.aureonmusicgroup.com' } }, URL, console }, { filename: path });
    if (path.endsWith('SimilarSongs.tsx')) vm.runInNewContext(code + '\nmodule.exports.testCard = SimilarSongCard;', { module, exports: module.exports, require: requireMock, document, navigator: { mediaSession: session }, window: { matchMedia: () => ({ matches: false }) }, console }, { filename: path });
    modules.set(path, module.exports); return module.exports;
  }
  const owner = load('lib/media-session-owner.ts');
  const preview = load('components/LatestPlayButton.tsx').LatestPlayButton;
  function addPreview(title) {
    const tree = preview({ title, src: `/api/preview/${title}`, artwork: '/album.png', analytics: { artistName: 'Artist' }, showPurchase: false });
    const buttonProps = tree.props.children[0].props;
    const button = { disabled: false, props: buttonProps, click: () => buttonProps.onClick(), focus() {} };
    buttonProps.ref.current = button; buttons.push(button);
    while (effects.length) effects.shift()();
    return button;
  }
  function addRelated(title) {
    const tree = load('components/discovery/SimilarSongs.tsx').testCard({ song: { id: title, title, artistName: 'Related Artist', imageUrl: '/related.png' }, confidence: 1, position: 1 });
    const body = tree.props.children[1];
    const audioProps = body.props.children[4].props;
    const audio = new Audio(); audioProps.ref.current = audio; audio.src = audioProps.src;
    audio.setAttribute('data-aureon-related-audio', 'true');
    for (const [prop,event] of [['onPlay','play'],['onPause','pause'],['onTimeUpdate','timeupdate']]) audio['on'+event] = audioProps[prop];
    audios.push(audio);
    const props = body.props.children[3].props.children[0].props;
    const button = { disabled: false, props, click: () => props.onClick(), focus() {} };
    props.ref.current = button; buttons.push(button);
    while (effects.length) effects.shift()();
    return { button, audio };
  }
  function bridge() {
    load('components/music/BackgroundPlaybackBridge.tsx').default();
    const cleanups = [];
    while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup); }
    return () => cleanups.forEach(fn => fn());
  }
  return { fire, audios, member, owner, session, handlers, addPreview, addRelated, bridge, setPlayer(value) { player = value; }, setVisibilityState(value) { document.visibilityState = value; } };
}

test('preview focus is inert; next/previous keep metadata, controls and one audio owner', async () => {
  const r = runtime(), a = r.addPreview('A'), b = r.addPreview('B');
  for (const event of ['onPointerEnter', 'onFocus', 'onTouchStart']) assert.equal(a.props[event], undefined);
  await r.member.play();
  await a.click();
  const preview = r.audios[1];
  assert.equal(r.member.paused, true);
  assert.equal(preview.paused, false);
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.metadata.artist, 'Artist');
  assert.equal(r.session.metadata.artwork[0].sizes, '512x512');
  assert.equal(r.session.metadata.artwork[0].type, 'image/jpeg');
  assert.match(r.session.metadata.artwork[0].src, /format=jpeg/);
  assert.equal(r.handlers.get('seekbackward'), null);
  assert.equal(r.handlers.get('seekforward'), null);
  r.handlers.get('nexttrack')(); await Promise.resolve();
  assert.equal(r.session.metadata.title, 'B');
  assert.match(preview.src, /\/B$/);
  r.handlers.get('previoustrack')(); await Promise.resolve();
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.audios.length, 2);
  const loads = preview.loads;
  await a.click();
  assert.equal(preview.paused, true);
  assert.equal(preview.loads, loads);
});

test('remote preview Play reuses the 40-second limit and replays from zero', async () => {
  const r = runtime(), a = r.addPreview('A'); await a.click();
  const audio = r.audios[1]; audio.currentTime = 40; audio.emit('timeupdate');
  assert.equal(audio.paused, true);
  r.handlers.get('play')(); await Promise.resolve();
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.paused, false);
  audio.currentTime = 41; audio.emit('timeupdate');
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 40);
});

test('inactive member bridge and its cleanup cannot clear a preview session', async () => {
  const r = runtime(), a = r.addPreview('A'); await a.click();
  const metadata = r.session.metadata, next = r.handlers.get('nexttrack');
  const cleanup = r.bridge();
  assert.equal(r.session.metadata, metadata);
  assert.equal(r.handlers.get('nexttrack'), next);
  cleanup();
  assert.equal(r.session.metadata, metadata);
  assert.equal(r.handlers.get('nexttrack'), next);
  r.owner.releaseMediaSession(r.member);
  assert.equal(r.session.metadata, metadata);
});

test('member resume takes ownership; preview pauses without replacing member controls', async () => {
  const r = runtime(), a = r.addPreview('A'); await a.click();
  const previewMetadata = r.session.metadata;
  let skips = 0;
  r.setPlayer({ currentSong: { title: 'Full Song', artistName: 'Member Artist', imageUrl: '/full.png' }, isPlaying: false, next() { skips++; }, previous() {}, seekTo() {}, toggle: async () => r.member.play() });
  r.bridge(); await r.member.play();
  assert.equal(r.audios[1].paused, true);
  assert.notEqual(r.session.metadata, previewMetadata, 'member playback must publish a fresh native metadata snapshot at the real play event');
  assert.equal(r.session.metadata.title, 'Full Song');
  assert.equal(r.session.playbackState, 'playing');
  r.handlers.get('nexttrack')(); assert.equal(skips, 1);
  r.member.currentTime = 80; r.member.emit('timeupdate');
  assert.equal(r.member.paused, false);
  await a.click();
  assert.equal(r.member.paused, true);
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.playbackState, 'playing');
});


test('playing and foreground publish fresh metadata after a platform clear', async () => {
  const r = runtime(), a = r.addPreview('A'); await a.click();
  const audio = r.audios[1], initialMetadata = r.session.metadata;
  audio.emit('loadedmetadata'); audio.emit('playing');
  assert.notEqual(r.session.metadata, initialMetadata);
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.metadata.artist, 'Artist');
  assert.equal(r.session.metadata.artwork.length, 4);
  assert.equal(Array.from(r.session.metadata.artwork, image => image.sizes).join(','), '512x512,256x256,128x128,96x96');
  r.session.metadata = null;
  audio.emit('playing');
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.metadata.artist, 'Artist');
  assert.equal(audio.attributes['data-aureon-media-session-title'], 'A');
  assert.equal(audio.attributes['data-aureon-media-session-artist'], 'Artist');
  r.session.metadata = null; r.fire('pageshow');
  assert.equal(r.session.metadata.title, 'A');
  r.session.metadata = null; r.setVisibilityState('hidden'); r.fire('visibilitychange');
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.playbackState, 'playing');
  r.session.metadata = null; r.fire('pagehide');
  assert.equal(r.session.metadata.title, 'A');
  r.session.metadata = null; r.fire('visibilitychange');
  assert.equal(r.session.metadata.title, 'A');
});


test('artwork rejection cannot remove title, artist or track controls', async () => {
  const r = runtime({ rejectArtwork: true }), a = r.addPreview('A'); await a.click();
  assert.equal(r.session.metadata.title, 'A');
  assert.equal(r.session.metadata.artist, 'Artist');
  assert.equal(r.session.metadata.artwork.length, 0);
  assert.equal(r.audios[1].attributes['data-aureon-media-artwork-status'], 'rejected');
  assert.equal(typeof r.handlers.get('nexttrack'), 'function');
  assert.equal(r.session.playbackState, 'playing');
});


test('related-song playback publishes metadata and obeys preview limits and ownership', async () => {
  const r = runtime(), regular = r.addPreview('A'), related = r.addRelated('R');
  await regular.click(); await related.button.click();
  assert.equal(r.audios.find(audio => audio.attributes['data-aureon-preview-audio'] === 'true').paused, true);
  assert.equal(r.session.metadata.title, 'R');
  assert.equal(r.session.metadata.artist, 'Related Artist');
  related.audio.currentTime = 41; related.audio.emit('timeupdate');
  assert.equal(related.audio.paused, true); assert.equal(related.audio.currentTime, 40);
  r.handlers.get('play')(); await Promise.resolve();
  assert.equal(related.audio.currentTime, 0); assert.equal(related.audio.paused, false);
  await regular.click();
  assert.equal(related.audio.paused, true); assert.equal(r.session.metadata.title, 'A');
});
