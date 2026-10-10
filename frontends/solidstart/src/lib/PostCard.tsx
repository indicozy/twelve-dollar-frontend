import type { Post } from "./api";
import { likeAction } from "./actions";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function PostCard(props: { post: Post; link?: boolean }) {
  return (
    <article class="post" data-post-id={props.post.id}>
      <header>
        <span class="author">@{props.post.author}</span>
        <time datetime={props.post.created_at}>{fmt.format(new Date(props.post.created_at))} UTC</time>
      </header>
      <p>{props.post.body}</p>
      <footer>
        <form action={likeAction} method="post">
          <input type="hidden" name="id" value={props.post.id} />
          <button type="submit" class="like">
            ♥ <span>{props.post.like_count}</span>
          </button>
        </form>
        {props.link !== false ? (
          <a href={`/posts/${props.post.id}`}>#{props.post.id}</a>
        ) : (
          <span class="muted">#{props.post.id}</span>
        )}
      </footer>
    </article>
  );
}
