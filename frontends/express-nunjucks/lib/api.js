// API client. Node's built-in fetch (undici) keeps a pooled keep-alive connection to the API.
// No caching: every call hits the API.
const BACKEND_URL = (process.env.BACKEND_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');

/** `authorization` is the full header value ("Bearer <jwt>"), or null/undefined to send none. */
const authHeaders = (authorization) => (authorization ? { Authorization: authorization } : {});

export async function getFeed() {
  const res = await fetch(`${BACKEND_URL}/feed`);
  if (res.status !== 200) throw new Error(`feed: backend returned ${res.status}`);
  return (await res.json()).posts;
}

export async function getPost(id) {
  const res = await fetch(`${BACKEND_URL}/posts/${encodeURIComponent(id)}`);
  if (res.status === 404 || res.status === 400) {
    await res.body?.cancel();
    return null;
  }
  if (res.status !== 200) throw new Error(`post: backend returned ${res.status}`);
  return (await res.json()).post;
}

/** Returns the raw fetch Response; callers read the body as JSON or pass the bytes through. */
export function createPost(authorization, body) {
  return fetch(`${BACKEND_URL}/posts`, {
    method: 'POST',
    headers: { ...authHeaders(authorization), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

export function likePost(authorization, id) {
  return fetch(`${BACKEND_URL}/posts/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    headers: authHeaders(authorization),
  });
}
