import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const suffix = Array.isArray(path) ? path.join('/') : '';
  if (!suffix || suffix.includes('..')) {
    return NextResponse.json({ error: 'Invalid Firebase token path.' }, { status: 400 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`https://securetoken.googleapis.com/${suffix}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', 'application/json');
  headers.set('referer', 'https://www.aureonmusicgroup.com/');
  headers.set('origin', 'https://www.aureonmusicgroup.com');

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store'
    });
    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Firebase token proxy failed', error);
    return NextResponse.json({ error: { message: 'TOKEN_PROXY_UNAVAILABLE' } }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
