const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function runtime() {
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
    '@/lib/get-artwork': { DEFAULT_ARTWORK: '/cover.png', getArtwork: song => song.imageUrl },
    './MusicPlayerProvider': { useMusicPlayer: () => player },
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const requireMock = name => name === '@/lib/media-session-owner' ? load('lib/media-session-owner.ts') : name.endsWith('.css') ? {} : mocks[name] || {};
    vm.runInNewContext(code, { module, exports: module.exports, require: requireMock, document, Audio, navigator: { mediaSession: session }, MediaMetadata: class { constructor(data) { Object.assign(this, data); } }, window: { location: { origin: 'https://www.aureonmusicgroup.com' } }, URL, console }, { filename: path });
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
  function bridge() {
    load('components/music/BackgroundPlaybackBridge.tsx').default();
    const cleanups = [];
    while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup); }
    return () => cleanups.forEach(fn => fn());
  }
  return { audios, member, owner, session, handlers, addPreview, bridge, setPlayer(value) { player = value; } };
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
  assert.equal(r.session.metadata.artwork[0].sizes, 'any');
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
  let skips = 0;
  r.setPlayer({ currentSong: { title: 'Full Song', artistName: 'Member Artist', imageUrl: '/full.png' }, isPlaying: false, next() { skips++; }, previous() {}, seekTo() {}, toggle: async () => r.member.play() });
  r.bridge(); await r.member.play();
  assert.equal(r.audios[1].paused, true);
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
