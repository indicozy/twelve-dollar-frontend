// Demo session: same HS256 token as frontends/sveltekit/src/lib/server/session.ts (the API has no login endpoint).
import { createHmac } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'twelve-dollar-challenge';
export const TOKEN_COOKIE = 'token';

const b64url = (s) => Buffer.from(s).toString('base64url');

export function signToken(userId, username) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ sub: String(userId), username, iat: now, exp: now + 7 * 86400 }));
  const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

/** Value of one cookie from the Cookie header (a few lines instead of the cookie-parser middleware). */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

export const currentToken = (req) => readCookie(req.headers.cookie, TOKEN_COOKIE);

/** Read from the token cookie's payload on every request (not verified, like the JS variants). */
export function currentUsername(token) {
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).username ?? null;
  } catch {
    return null;
  }
}
