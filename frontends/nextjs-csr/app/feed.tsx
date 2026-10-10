"use client";

import { useCallback, useEffect, useState } from "react";
import { createPost, getFeed, getToken, type Post } from "@/lib/api";
import { PostCard, PostSkeleton } from "./post-card";

/** The whole feed page is rendered in the browser: the exported HTML only has the skeletons. */
export function FeedPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getFeed().then(setPosts, (e) => setError(String(e)));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <Compose onPosted={load} />
      <h1>Latest</h1>
      {error ? (
        <p className="error">{error}</p>
      ) : posts ? (
        <section className="feed">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </section>
      ) : (
        <PostSkeleton count={20} />
      )}
    </>
  );
}

function Compose({ onPosted }: { onPosted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(form: FormData) {
    if (!getToken()) return void (location.href = "/login");
    setPending(true);
    const { status, data } = await createPost(String(form.get("body") ?? ""));
    setPending(false);
    if (status !== 201) return setError(data.error ?? `error ${status}`);
    setError(null);
    onPosted();
  }

  return (
    <form action={submit} className="compose">
      <textarea name="body" maxLength={500} placeholder="What's happening on the $12 server?" required rows={3} />
      <div>
        {error ? <span className="error">{error}</span> : <span className="muted">max 500 chars</span>}
        <button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
