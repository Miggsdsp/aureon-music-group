import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK = '/images/branding/Aureon_Header_Logo.png';

function allowedRemote(url: URL, requestUrl: URL) {
  if (url.origin === requestUrl.origin) return true;
  const host = url.hostname.toLowerCase();
  return host === 'firebasestorage.googleapis.com' || host === 'storage.googleapis.com' || host.endsWith('.googleapis.com');
}

async function artworkResponse(response: Response, normalized: boolean) {
  const headers: Record<string, string> = {
    'Content-Type': response.headers.get('content-type') || 'image/png',
    'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  };
  if (normalized && response.ok) {
    const image = await sharp(Buffer.from(await response.arrayBuffer()), { limitInputPixels: 40000000 })
      .rotate()
      .resize(512, 512, { fit: 'contain', background: '#000000' })
      .flatten({ background: '#000000' })
      .jpeg({ quality: 85 })
      .toBuffer();
    headers['Content-Type'] = 'image/jpeg';
    headers['Content-Length'] = String(image.byteLength);
    return new Response(new Uint8Array(image).buffer, { status: 200, headers });
  }
  return new Response(response.body, { status: response.ok ? 200 : 404, headers });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get('src') || FALLBACK;
  const normalized = requestUrl.searchParams.get('format') === 'jpeg';

  let source: URL;
  try {
    source = new URL(raw, requestUrl.origin);
  } catch {
    source = new URL(FALLBACK, requestUrl.origin);
  }

  if (!allowedRemote(source, requestUrl)) {
    source = new URL(FALLBACK, requestUrl.origin);
  }

  try {
    const response = await fetch(source, { redirect: 'follow', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Artwork fetch failed: ${response.status}`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) throw new Error('Artwork source is not an image.');

    return await artworkResponse(response, normalized);
  } catch {
    const fallback = new URL(FALLBACK, requestUrl.origin);
    const response = await fetch(fallback, { cache: 'force-cache' });
    return artworkResponse(response, normalized);
  }
}
