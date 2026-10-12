import { Form, Link } from "react-router";
import type { Post } from "~/lib/api.server";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

// <Form> without `action` posts to the current route (the feed's or the post page's action).
// <Link> prefetching is off by default in React Router (prefetch="none").
export function PostCard({ post, link = true }: { post: Post; link?: boolean }) {
  return (
    <article className="post" data-post-id={post.id}>
      <header>
        <span className="author">@{post.author}</span>
        <time dateTime={post.created_at}>{fmt.format(new Date(post.created_at))} UTC</time>
      </header>
      <p>{post.body}</p>
      <footer>
        <Form method="post">
          <input type="hidden" name="id" value={post.id} />
          <button type="submit" className="like">
            ♥ <span>{post.like_count}</span>
          </button>
        </Form>
        {link ? <Link to={`/posts/${post.id}`}>#{post.id}</Link> : <span className="muted">#{post.id}</span>}
      </footer>
    </article>
  );
}
