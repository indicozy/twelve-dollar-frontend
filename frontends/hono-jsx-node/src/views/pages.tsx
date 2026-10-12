import type { Post } from '../lib/api.js';
import { PostCard } from './PostCard.js';

export const FeedPage = ({ posts, error }: { posts: Post[]; error: string | null }) => (
  <>
    <form method="post" action="/actions/create" class="compose">
      <textarea name="body" maxlength={500} placeholder="What's happening on the $12 server?" required rows={3}></textarea>
      <div>
        {error ? <span class="error">{error}</span> : <span class="muted">max 500 chars</span>}
        <button type="submit">Post</button>
      </div>
    </form>
    <h1>Latest</h1>
    <section class="feed">
      {posts.map((post) => (
        <PostCard post={post} link={true} />
      ))}
    </section>
  </>
);

export const PostPage = ({ post }: { post: Post }) => (
  <>
    <a href="/" class="back">
      ← back to feed
    </a>
    <PostCard post={post} link={false} />
  </>
);

export const LoginPage = () => (
  <form method="post" action="/login" class="login">
    <h1>Sign in</h1>
    <p class="muted">The API has no login endpoint; this signs a demo HS256 token (like the challenge's seed tokens).</p>
    <label>
      User id <input name="user_id" type="number" min="1" value="1" required />
    </label>
    <label>
      Username <input name="username" value="golden_ember_1" required />
    </label>
    <button type="submit">Continue</button>
  </form>
);

export const NotFoundPage = () => (
  <div class="empty">
    <h1>Not found</h1>
    <a href="/">← back to feed</a>
  </div>
);
