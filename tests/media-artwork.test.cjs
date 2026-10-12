const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const sharp = require('sharp');

function route(fetch) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('app/api/media/artwork/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require, fetch, Response, Request, URL, Buffer, Uint8Array });
  return module.exports.GET;
}
async function png() {
  return sharp({ create: { width: 1254, height: 800, channels: 4, background: { r: 80, g: 20, b: 10, alpha: 0.5 } } }).png().toBuffer();
}

test('normalized artwork returns a real square JPEG with accurate headers', async () => {
  const input = await png();
  const get = route(async () => new Response(input, { headers: { 'Content-Type': 'image/png' } }));
  const response = await get(new Request('https://www.aureonmusicgroup.com/api/media/artwork?format=jpeg&v=2&src=/cover.png'));
  const output = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(output).metadata();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('content-length'), String(output.length));
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 512); assert.equal(metadata.height, 512);
  assert.equal(metadata.hasAlpha, false);
});

test('legacy artwork requests retain the original image bytes', async () => {
  const input = await png();
  const get = route(async () => new Response(input, { headers: { 'Content-Type': 'image/png' } }));
  const response = await get(new Request('https://www.aureonmusicgroup.com/api/media/artwork?src=/cover.png'));
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), input);
});

test('unreadable artwork uses the normalized branding fallback', async () => {
  const fallback = await png(); const requests = [];
  const get = route(async url => {
    requests.push(url.href);
    return requests.length === 1 ? new Response('not a PNG', { headers: { 'Content-Type': 'image/png' } }) : new Response(fallback, { headers: { 'Content-Type': 'image/png' } });
  });
  const response = await get(new Request('https://www.aureonmusicgroup.com/api/media/artwork?format=jpeg&src=/broken.png'));
  assert.equal(response.status, 200); assert.match(requests[1], /Aureon_Header_Logo.png/);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'jpeg'); assert.equal(metadata.width, 512);
});
