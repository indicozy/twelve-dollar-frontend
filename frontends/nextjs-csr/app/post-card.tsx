"use client";

import Link from "next/link";
import { useState } from "react";
import { getToken, likePost, type Post } from "@/lib/api";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function PostCard({ post, link = true }: { post: Post; link?: boolean }) {
  const [likes, setLikes] = useState(post.like_count);
  const [busy, setBusy] = useState(false);

  async function like() {
    if (!getToken()) return void (location.href = "/login");
    setBusy(true);
    const { status } = await likePost(post.id);
    if (status === 201) setLikes((n) => n + 1);
    setBusy(false);
  }

  return (
    <article className="post" data-post-id={post.id}>
      <header>
        <span className="author">@{post.author}</span>
        <time dateTime={post.created_at}>{fmt.format(new Date(post.created_at))} UTC</time>
      </header>
      <p>{post.body}</p>
      <footer>
        <button type="button" className="like" onClick={like} disabled={busy}>
          ♥ <span>{likes}</span>
        </button>
        {link ? <Link href={`/posts/${post.id}`}>#{post.id}</Link> : <span className="muted">#{post.id}</span>}
      </footer>
    </article>
  );
}

export function PostSkeleton({ count = 1 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => <article key={i} className="post skeleton" aria-hidden />);
}
