// GET / : the compose form and the 20 latest posts, from a fresh GET /feed on every request.
import { createRoute } from 'honox/factory';
import { PostCard } from '../components/PostCard';
import { getFeed } from '../lib/api';

export default createRoute(async (c) => {
  // A rejected post comes back as /?error=... (Post/Redirect/Get), like the Express and Flask variants.
  const error = c.req.query('error') ?? null;
  const posts = await getFeed();
  return c.render(
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
    </>,
  );
});
