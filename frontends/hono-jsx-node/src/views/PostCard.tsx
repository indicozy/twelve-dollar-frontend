import type { Post } from '../lib/api.js';

// Date text: Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}) + " UTC",
// like the other JS variants ("Dec 31, 2025, 11:59 PM UTC"). One formatter for the process.
const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const formatDate = (iso: string) => `${fmt.format(new Date(iso))} UTC`;

/** `link`: feed cards link to the post page; the post page shows the id as plain text. */
export const PostCard = ({ post, link }: { post: Post; link: boolean }) => (
  <article class="post" data-post-id={post.id}>
    <header>
      <span class="author">@{post.author}</span>
      <time datetime={post.created_at}>{formatDate(post.created_at)}</time>
    </header>
    <p>{post.body}</p>
    <footer>
      <form method="post" action="/actions/like">
        <input type="hidden" name="id" value={post.id} />
        <button type="submit" class="like">
          ♥ <span>{post.like_count}</span>
        </button>
      </form>
      {link ? <a href={`/posts/${post.id}`}>#{post.id}</a> : <span class="muted">#{post.id}</span>}
    </footer>
  </article>
);
