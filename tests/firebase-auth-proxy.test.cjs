const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const proxySource = fs.readFileSync(path.join(root, 'lib/firebase-auth-fetch-proxy.ts'), 'utf8');
const proxyScript = ts.transpileModule(proxySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

function installProxy(nativeFetch) {
  const window = {
    location: { hostname: 'www.aureonmusicgroup.com', origin: 'https://www.aureonmusicgroup.com' },
    fetch: nativeFetch
  };
  vm.runInNewContext(proxyScript, { window, URL, Request, Response });
  return window.fetch;
}

test('password sign-in falls back to Firebase directly when the same-origin proxy returns 5xx', async () => {
  const urls = [];
  const fetch = installProxy(async input => {
    const url = String(input instanceof Request ? input.url : input);
    urls.push(url);
    return url.includes('/api/firebase-auth/')
      ? new Response('proxy unavailable', { status: 503 })
      : new Response('{"idToken":"test"}', { status: 200 });
  });

  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test', {
    method: 'POST',
    body: '{}'
  });

  assert.equal(response.status, 200);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/api\/firebase-auth\/v1\/accounts:signInWithPassword/);
  assert.match(urls[1], /^https:\/\/identitytoolkit\.googleapis\.com\//);
});

test('invalid credentials are not retried through a second endpoint', async () => {
  let calls = 0;
  const fetch = installProxy(async () => {
    calls += 1;
    return new Response('{"error":"INVALID_LOGIN_CREDENTIALS"}', { status: 400 });
  });

  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test', {
    method: 'POST',
    body: '{}'
  });

  assert.equal(response.status, 400);
  assert.equal(calls, 1);
});

test('Auth and token proxies forward Firebase App Check and client headers', () => {
  for (const route of [
    'app/api/firebase-auth/[...path]/route.ts',
    'app/api/firebase-token/[...path]/route.ts'
  ]) {
    const source = fs.readFileSync(path.join(root, route), 'utf8');
    assert.match(source, /x-firebase-appcheck/);
    assert.match(source, /x-firebase-gmpid/);
    assert.match(source, /x-firebase-client/);
  }
});

test('changed Firebase proxy TypeScript files transpile without syntax diagnostics', () => {
  for (const file of [
    'lib/firebase-auth-fetch-proxy.ts',
    'app/api/firebase-auth/[...path]/route.ts',
    'app/api/firebase-token/[...path]/route.ts'
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    });
    const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(errors, [], `${file} should transpile cleanly`);
  }
});
