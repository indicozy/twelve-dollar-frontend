import { inject, Injectable, makeStateKey, REQUEST, TransferState } from '@angular/core';

const USERNAME = makeStateKey<string | null>('username');

function usernameFromCookieHeader(header: string | null): string | null {
  const token = /(?:^|;\s*)token=([^;]*)/.exec(header ?? '')?.[1];
  if (!token) return null;
  try {
    const b64 = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    return JSON.parse(json).username ?? null;
  } catch {
    return null;
  }
}

/**
 * The signed-in name for the header. On the server it is read from the httpOnly `token` cookie of the current
 * request (REQUEST token, per request); it reaches the browser through TransferState since JS can't read the cookie.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  readonly username: string | null;

  constructor() {
    const state = inject(TransferState);
    const request = inject(REQUEST, { optional: true });
    if (request) {
      this.username = usernameFromCookieHeader(request.headers.get('cookie'));
      state.set(USERNAME, this.username);
    } else {
      this.username = state.get(USERNAME, null);
    }
  }
}
