import { createHmac } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "twelve-dollar-challenge";
export const TOKEN_COOKIE = "token";

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Same HS256 tokens as the challenge's seed/tokens.json (no login endpoint exists on the API). */
export function signToken(userId: number, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ sub: String(userId), username, iat: now, exp: now + 7 * 86400 }));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/**
 * The raw `token` cookie (the JWT as-is, like the other variants). React Router's `createCookie` would wrap the
 * value in base64-encoded JSON, so the header is read and written by hand.
 */
export function currentToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === TOKEN_COOKIE) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export const tokenCookie = (token: string) => `${TOKEN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`;

export function currentUsername(request: Request): string | null {
  const token = currentToken(request);
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).username ?? null;
  } catch {
    return null;
  }
}
