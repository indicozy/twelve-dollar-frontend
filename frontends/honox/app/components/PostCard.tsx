import type { Post } from '../lib/api';
import LikeButton from '../islands/like-button';

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
      <LikeButton id={post.id} likes={post.like_count} />
      {link ? <a href={`/posts/${post.id}`}>#{post.id}</a> : <span class="muted">#{post.id}</span>}
    </footer>
  </article>
);
