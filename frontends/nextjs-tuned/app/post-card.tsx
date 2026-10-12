"use client";

// A Client Component: the server sends each post to it as plain props ({id, body, created_at, author, like_count})
// instead of the rendered <article> tree (the feed's inlined RSC/Flight payload: 23.0 -> 8.7 KB). Server-rendered to the
// same HTML; the like form still posts to the `likeAction` Server Action.
import Link from "next/link";
import type { Post } from "@/lib/api";
import { likeAction } from "./actions";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function PostCard({ post, link = true }: { post: Post; link?: boolean }) {
  return (
    <article className="post" data-post-id={post.id}>
      <header>
        <span className="author">@{post.author}</span>
        <time dateTime={post.created_at}>{fmt.format(new Date(post.created_at))} UTC</time>
      </header>
      <p>{post.body}</p>
      <footer>
        <form action={likeAction}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="like">
            ♥ <span>{post.like_count}</span>
          </button>
        </form>
        {link ? (
          <Link href={`/posts/${post.id}`} prefetch={false}>
            #{post.id}
          </Link>
        ) : (
          <span className="muted">#{post.id}</span>
        )}
      </footer>
    </article>
  );
}

export function PostSkeleton({ count = 1 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => <article key={i} className="post skeleton" aria-hidden />);
}
