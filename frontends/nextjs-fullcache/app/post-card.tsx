import Link from "next/link";
import type { Post } from "@/lib/api";
import { LikeButton } from "./likes";

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
        <LikeButton id={post.id} initial={post.like_count} />
        {link ? (
          <Link href={`/posts/${post.id}`}>
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
