import { createHmac } from 'node:crypto';
import type { Cookie } from '@builder.io/qwik-city';

const JWT_SECRET = process.env.JWT_SECRET ?? 'twelve-dollar-challenge';
export const TOKEN_COOKIE = 'token';

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Same HS256 tokens as the challenge's seed/tokens.json (no login endpoint exists on the API). */
export function signToken(userId: number, username: string): string {
	const now = Math.floor(Date.now() / 1000);
	const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body = b64url(JSON.stringify({ sub: String(userId), username, iat: now, exp: now + 7 * 86400 }));
	const sig = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
	return `${head}.${body}.${sig}`;
}

export const currentToken = (cookie: Cookie) => cookie.get(TOKEN_COOKIE)?.value ?? null;

export function currentUsername(cookie: Cookie): string | null {
	const token = currentToken(cookie);
	if (!token) return null;
	try {
		return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).username ?? null;
	} catch {
		return null;
	}
}
