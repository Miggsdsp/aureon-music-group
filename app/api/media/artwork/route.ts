import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK = '/images/branding/Aureon_Header_Logo.png';

function allowedRemote(url: URL, requestUrl: URL) {
  if (url.origin === requestUrl.origin) return true;
  const host = url.hostname.toLowerCase();
  return host === 'firebasestorage.googleapis.com' || host === 'storage.googleapis.com' || host.endsWith('.googleapis.com');
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get('src') || FALLBACK;

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

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    const fallback = new URL(FALLBACK, requestUrl.origin);
    const response = await fetch(fallback, { cache: 'force-cache' });
    return new Response(response.body, {
      status: response.ok ? 200 : 404,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
