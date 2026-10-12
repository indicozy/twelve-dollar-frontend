// POST /actions/like : the like form. A plain form post gets a 303 back to the page it came from (no token cookie →
// /login). The hydrated island (app/islands/like-button.tsx) sends Accept: application/json and gets the API's status
// and JSON instead (401 JSON without a token cookie).
import { createRoute } from 'honox/factory';
import { likePost } from '../../lib/api';
import { backTo, form, passthrough } from '../../lib/forms';

export const POST = createRoute(form, async (c) => {
  const token = c.get('token');
  const wantsJson = c.req.header('accept')?.includes('application/json') ?? false;
  if (!token) return wantsJson ? c.json({ error: 'not signed in' }, 401) : c.redirect('/login', 303);
  const body = await c.req.parseBody();
  const r = await likePost(`Bearer ${token}`, String(body.id ?? ''));
  if (wantsJson) return passthrough(r);
  await r.body?.cancel();
  return c.redirect(backTo(c.req.header('referer'), c.req.header('host')), 303);
});
