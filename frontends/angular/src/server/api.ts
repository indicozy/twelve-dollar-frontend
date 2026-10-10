// Server-only API client (imported by server.ts and app.config.server.ts, never by browser code).
// No caching: every call hits the API.
import type { Post } from '../app/post';

export const BACKEND_URL = process.env['BACKEND_URL'] ?? 'http://127.0.0.1:4000';

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(BACKEND_URL + path, init);
  return { status: res.status, data: (await res.json()) as T };
}

/** `authorization` is the full header value ("Bearer <jwt>"), or null to send none. */
const authHeaders = (authorization: string | null | undefined): Record<string, string> =>
  authorization ? { Authorization: authorization } : {};

export function createPost(authorization: string | null | undefined, body: string) {
  return call<{ post?: Post; error?: string }>('/posts', {
    method: 'POST',
    headers: { ...authHeaders(authorization), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export function likePost(authorization: string | null | undefined, id: string) {
  return call<{ liked?: boolean; already_liked?: boolean; post_id?: number; error?: string }>(
    `/posts/${encodeURIComponent(id)}/like`,
    { method: 'POST', headers: authHeaders(authorization) },
  );
}
