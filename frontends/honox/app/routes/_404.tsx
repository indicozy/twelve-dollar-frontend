import type { NotFoundHandler } from 'hono';

// Unknown paths and missing posts (c.notFound()): status 404, header still shows the signed-in user.
const handler: NotFoundHandler = (c) => {
  c.status(404);
  return c.render(
    <div class="empty">
      <h1>Not found</h1>
      <a href="/">← back to feed</a>
    </div>,
  );
};

export default handler;
