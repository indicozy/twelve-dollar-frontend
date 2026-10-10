import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET ?? "twelve-dollar-challenge";
export const TOKEN_COOKIE = "token";
/** Readable by the browser so the header can show the name without making every page per-request. */
export const NAME_COOKIE = "username";

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** Same HS256 tokens as the challenge's seed/tokens.json (no login endpoint exists on the API). */
export function signToken(userId: number, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ sub: String(userId), username, iat: now, exp: now + 7 * 86400 }));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export async function currentToken(): Promise<string | null> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? null;
}
