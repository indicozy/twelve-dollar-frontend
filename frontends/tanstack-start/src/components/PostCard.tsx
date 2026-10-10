import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { FormEvent } from "react";
import { likeAction } from "../lib/server-fns";
import type { Post } from "../lib/types";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function PostCard({ post, link = true }: { post: Post; link?: boolean }) {
  const like = useServerFn(likeAction);
  const queryClient = useQueryClient();

  // With JS: call the server function over RPC, then refetch the post data on the page (feed / post queries).
  // Without JS: the browser posts the form to likeAction.url and follows the 303 back.
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await like({ data: new FormData(e.currentTarget) });
    await queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "feed" || q.queryKey[0] === "post" });
  }

  return (
    <article className="post" data-post-id={post.id}>
      <header>
        <span className="author">@{post.author}</span>
        <time dateTime={post.created_at}>{fmt.format(new Date(post.created_at))} UTC</time>
      </header>
      <p>{post.body}</p>
      <footer>
        <form method="post" action={likeAction.url} onSubmit={onSubmit}>
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="like">
            ♥ <span>{post.like_count}</span>
          </button>
        </form>
        {link ? (
          <Link to="/posts/$id" params={{ id: String(post.id) }}>
            #{post.id}
          </Link>
        ) : (
          <span className="muted">#{post.id}</span>
        )}
      </footer>
    </article>
  );
}
