'use client';

// Firebase Auth captures the browser fetch implementation during SDK startup.
// Install Aureon's same-origin routing before firebase/auth is evaluated so
// mobile Safari/cellular requests do not bypass the proxy.
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const marker = '__aureonFirebaseAuthFetchProxy';
  const globalWindow = window as typeof window & { [key: string]: unknown };

  if (!globalWindow[marker]) {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : String(input);
      let url: URL;
      try {
        url = new URL(raw, window.location.origin);
      } catch {
        // Fall back to the browser request unchanged if URL parsing fails.
        return nativeFetch(input, init);
      }

      let proxiedPath = '';
      const isPasswordSignIn =
        url.hostname === 'identitytoolkit.googleapis.com' &&
        url.pathname.endsWith('/accounts:signInWithPassword');

      if (url.hostname === 'identitytoolkit.googleapis.com') {
        proxiedPath = `/api/firebase-auth${url.pathname}${url.search}`;
      } else if (url.hostname === 'securetoken.googleapis.com') {
        proxiedPath = `/api/firebase-token${url.pathname}${url.search}`;
      }

      if (proxiedPath) {
        const target = new URL(proxiedPath, window.location.origin);

        // Keep a replayable copy so a transient same-origin/Vercel proxy
        // failure cannot strand an email/password sign-in attempt.
        const directInput = input instanceof Request ? input.clone() : input;
        const proxiedInput = input instanceof Request ? new Request(target, input) : target.toString();

        try {
          const response = await nativeFetch(proxiedInput, init);
          if (isPasswordSignIn && response.status >= 500) {
            try {
              return await nativeFetch(directInput, init);
            } catch {
              // Preserve the proxy response if both routes are unavailable.
            }
          }
          return response;
        } catch (proxyError) {
          if (isPasswordSignIn) {
            try {
              return await nativeFetch(directInput, init);
            } catch {
              // Preserve the original proxy error for Firebase's error mapper.
            }
          }
          throw proxyError;
        }
      }

      return nativeFetch(input, init);
    }) as typeof window.fetch;

    globalWindow[marker] = true;
  }
}
