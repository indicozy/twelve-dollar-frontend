// Runs for every route: the token cookie and the signed-in name (the header shows @username).
import { getCookie } from 'hono/cookie';
import { createRoute } from 'honox/factory';
import { currentUsername, TOKEN_COOKIE } from '../lib/session';

export default createRoute(async (c, next) => {
  const token = getCookie(c, TOKEN_COOKIE) || undefined;
  c.set('token', token);
  c.set('username', currentUsername(token));
  await next();
});
