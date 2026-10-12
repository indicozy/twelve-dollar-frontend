// Demo session: the same HS256 token as the other variants (the API has no login endpoint), signed with hono/jwt.
import { decode, sign } from 'hono/jwt';

const JWT_SECRET = process.env.JWT_SECRET ?? 'twelve-dollar-challenge';
export const TOKEN_COOKIE = 'token';

export function signToken(userId: number, username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign({ sub: String(userId), username, iat: now, exp: now + 7 * 86400 }, JWT_SECRET, 'HS256');
}

/** Read from the token cookie's payload on every request (not verified, like the JS variants). */
export function currentUsername(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const { username } = decode(token).payload as { username?: unknown };
    return typeof username === 'string' ? username : null;
  } catch {
    return null;
  }
}
