import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const suffix = Array.isArray(path) ? path.join('/') : '';
  if (!suffix || suffix.includes('..')) {
    return NextResponse.json({ error: 'Invalid Firebase Auth path.' }, { status: 400 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`https://identitytoolkit.googleapis.com/${suffix}`);
  incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));

  const headers = new Headers();
  for (const name of [
    'content-type',
    'authorization',
    'x-firebase-appcheck',
    'x-firebase-gmpid',
    'x-firebase-client',
    'x-client-version',
    'x-firebase-locale'
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('accept', 'application/json');
  headers.set('referer', 'https://www.aureonmusicgroup.com/');
  headers.set('origin', 'https://www.aureonmusicgroup.com');

  try {
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
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
    console.error('Firebase Auth proxy failed', error);
    return NextResponse.json({ error: { message: 'AUTH_PROXY_UNAVAILABLE' } }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
