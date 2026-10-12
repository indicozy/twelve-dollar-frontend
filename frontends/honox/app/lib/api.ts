// API client. The runtime's built-in fetch keeps pooled keep-alive connections to the API.
// No caching: every call hits the API.
const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');

export type Post = { id: number; author: string; body: string; like_count: number; created_at: string };

/** `authorization` is the full header value ("Bearer <jwt>"), or null/undefined to send none. */
const authHeaders = (authorization?: string | null): Record<string, string> =>
  authorization ? { Authorization: authorization } : {};

export async function getFeed(): Promise<Post[]> {
  const res = await fetch(`${BACKEND_URL}/feed`);
  if (res.status !== 200) throw new Error(`feed: backend returned ${res.status}`);
  return ((await res.json()) as { posts: Post[] }).posts;
}

export async function getPost(id: string): Promise<Post | null> {
  const res = await fetch(`${BACKEND_URL}/posts/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 400) {
    await res.body?.cancel();
    return null;
  }
  if (res.status !== 200) throw new Error(`post: backend returned ${res.status}`);
  return ((await res.json()) as { post: Post }).post;
}

/** Returns the raw fetch Response; callers read the body as JSON or pass it through. */
export function createPost(authorization: string | null | undefined, body: string): Promise<Response> {
  return fetch(`${BACKEND_URL}/posts`, {
    method: 'POST',
    headers: { ...authHeaders(authorization), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export function likePost(authorization: string | null | undefined, id: string): Promise<Response> {
  return fetch(`${BACKEND_URL}/posts/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    headers: authHeaders(authorization),
  });
}
