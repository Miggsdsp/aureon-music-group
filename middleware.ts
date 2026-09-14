import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale } from '@/lib/i18n/config';
import { shouldNoIndex } from '@/lib/index-policy';

const PUBLIC_FILE = /\.[^/]+$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('x-aureon-path', pathname);
  const withIndexPolicy = (response: NextResponse) => {
    if (shouldNoIndex(pathname)) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  };

  // Keep API/admin execution and public-file handling unchanged, but apply
  // indexing headers before these early returns (including dotted API paths).
  if (pathname.startsWith('/api') || pathname.startsWith('/admin') || pathname.startsWith('/_next') || PUBLIC_FILE.test(pathname)) {
    return withIndexPolicy(NextResponse.next({ request: { headers } }));
  }

  const first = pathname.split('/')[1] || '';
  const cookie = request.cookies.get('aureon_locale')?.value || '';
  const locale = isLocale(first) ? first : isLocale(cookie) ? cookie : defaultLocale;
  headers.set('x-aureon-locale', locale);
  let response: NextResponse;
  if (isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pathname.split('/').slice(2).join('/')}`.replace(/\/$/, '') || '/';
    response = NextResponse.rewrite(url, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers } });
  }
  response.cookies.set('aureon_locale', locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return withIndexPolicy(response);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
