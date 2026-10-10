import "server-only";
import { cacheLife, cacheTag } from "next/cache";

export type Post = {
  id: number;
  body: string;
  created_at: string;
  author: string;
  like_count: number;
};

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

export const tags = { feed: "feed", post: (id: number | string) => `post-${id}` };

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(BACKEND_URL + path, { ...init, cache: "no-store" });
  return { status: res.status, data: (await res.json()) as T };
}

// ---- reads: cached. Like counts in these results are only a starting value; the browser replaces them with live
// counts fetched straight from the API (app/likes.tsx), so neither page is revalidated when someone likes a post.

export async function getFeed(): Promise<Post[]> {
  "use cache";
  cacheLife("feed");
  cacheTag(tags.feed);
  const { status, data } = await call<{ posts: Post[] }>("/feed");
  if (status !== 200) throw new Error(`feed: backend returned ${status}`);
  return data.posts;
}

const isPostId = (id: string) => /^[1-9][0-9]{0,15}$/.test(id);

export async function getPost(id: string): Promise<Post | null> {
  "use cache";
  cacheLife("post");
  cacheTag(tags.post(id));
  if (!isPostId(id)) return null; // also the build-time placeholder, without calling the API
  const { status, data } = await call<{ post: Post }>(`/posts/${encodeURIComponent(id)}`);
  if (status === 404 || status === 400) return null;
  if (status !== 200) throw new Error(`post: backend returned ${status}`);
  return data.post;
}

// ---- writes: never cached, and they don't invalidate anything (see app/actions.ts)

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
