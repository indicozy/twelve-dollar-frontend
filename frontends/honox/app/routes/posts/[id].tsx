// GET /posts/:id : one post from a fresh GET /posts/:id; an API 404/400 renders the 404 page (status 404).
import { createRoute } from 'honox/factory';
import { PostCard } from '../../components/PostCard';
import { getPost } from '../../lib/api';

export default createRoute(async (c) => {
  const post = await getPost(c.req.param('id'));
  // The whole page renders before anything is sent, so a missing post is a real 404 (app/routes/_404.tsx).
  if (!post) return c.notFound();
  return c.render(
    <>
      <a href="/" class="back">
        ← back to feed
      </a>
      <PostCard post={post} link={false} />
    </>,
  );
});
