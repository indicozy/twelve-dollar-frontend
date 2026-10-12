// Server-only API client. No caching: every call hits the API.
export type Post = {
  id: number;
  body: string;
  created_at: string;
  author: string;
  like_count: number;
};

// Read at runtime from the process environment (not inlined by the build).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(BACKEND_URL + path, init);
  return { status: res.status, data: (await res.json()) as T };
}

export async function getFeed(): Promise<Post[]> {
  const { status, data } = await call<{ posts: Post[] }>("/feed");
  if (status !== 200) throw new Error(`feed: backend returned ${status}`);
  return data.posts;
}

export async function getPost(id: string): Promise<Post | null> {
  const { status, data } = await call<{ post: Post }>(`/posts/${encodeURIComponent(id)}`);
  if (status === 404 || status === 400) return null;
  if (status !== 200) throw new Error(`post: backend returned ${status}`);
  return data.post;
}

/** `authorization` is the full header value ("Bearer <jwt>"), or null to send none. */
const authHeaders = (authorization: string | null): Record<string, string> =>
  authorization ? { Authorization: authorization } : {};

export function createPost(authorization: string | null, body: string) {
  return call<{ post?: Post; error?: string }>("/posts", {
    method: "POST",
    headers: { ...authHeaders(authorization), "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export function likePost(authorization: string | null, id: string) {
  return call<{ liked?: boolean; already_liked?: boolean; post_id?: number; error?: string }>(
    `/posts/${encodeURIComponent(id)}/like`,
    { method: "POST", headers: authHeaders(authorization) },
  );
}
