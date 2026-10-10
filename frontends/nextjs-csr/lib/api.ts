// Browser-side API client. nginx (same origin) proxies /api/* to the Rust API, so no CORS is involved.
export type Post = {
  id: number;
  body: string;
  created_at: string;
  author: string;
  like_count: number;
};

const TOKEN_KEY = "token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Username from the JWT payload (display only; the API verifies the signature). */
export function tokenUsername(token: string | null): string | null {
  if (!token) return null;
  try {
    const json = atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).username ?? null;
  } catch {
    return null;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch("/api" + path, init);
  return { status: res.status, data: (await res.json()) as T };
}

export async function getFeed(): Promise<Post[]> {
  const { status, data } = await call<{ posts: Post[] }>("/feed");
  if (status !== 200) throw new Error(`feed: ${status}`);
  return data.posts;
}

export async function getPost(id: string): Promise<Post | null> {
  const { status, data } = await call<{ post: Post }>(`/posts/${encodeURIComponent(id)}`);
  if (status === 404 || status === 400) return null;
  if (status !== 200) throw new Error(`post: ${status}`);
  return data.post;
}

const auth = (): Record<string, string> => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export function createPost(body: string) {
  return call<{ post?: Post; error?: string }>("/posts", {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export function likePost(id: number) {
  return call<{ liked?: boolean; already_liked?: boolean; error?: string }>(`/posts/${id}/like`, {
    method: "POST",
    headers: auth(),
  });
}
