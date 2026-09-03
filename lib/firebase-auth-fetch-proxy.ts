'use client';

// Firebase Auth captures the browser fetch implementation during SDK startup.
// Install Aureon's same-origin routing before firebase/auth is evaluated so
// mobile Safari/cellular requests do not bypass the proxy.
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
  const marker = '__aureonFirebaseAuthFetchProxy';
  const globalWindow = window as typeof window & { [key: string]: unknown };

  if (!globalWindow[marker]) {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const raw = input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.origin);
        let proxiedPath = '';

        if (url.hostname === 'identitytoolkit.googleapis.com') {
          proxiedPath = `/api/firebase-auth${url.pathname}${url.search}`;
        } else if (url.hostname === 'securetoken.googleapis.com') {
          proxiedPath = `/api/firebase-token${url.pathname}${url.search}`;
        }

        if (proxiedPath) {
          const target = new URL(proxiedPath, window.location.origin);
          if (input instanceof Request) {
            return nativeFetch(new Request(target, input), init);
          }
          return nativeFetch(target.toString(), init);
        }
      } catch {
        // Fall back to the browser request unchanged if URL parsing fails.
      }

      return nativeFetch(input, init);
    }) as typeof window.fetch;

    globalWindow[marker] = true;
  }
}
