// POST /actions/create : the compose form. 303 to / (or /?error=<API message>); no token cookie → /login.
import { createRoute } from 'honox/factory';
import { createPost } from '../../lib/api';
import { form } from '../../lib/forms';

export const POST = createRoute(form, async (c) => {
  const token = c.get('token');
  if (!token) return c.redirect('/login', 303);
  const body = await c.req.parseBody();
  const r = await createPost(`Bearer ${token}`, String(body.body ?? ''));
  if (r.status !== 201) {
    const data = (await r.json().catch(() => ({}))) as { error?: string };
    return c.redirect(`/?error=${encodeURIComponent(data.error ?? `error ${r.status}`)}`, 303);
  }
  await r.body?.cancel();
  return c.redirect('/', 303);
});
