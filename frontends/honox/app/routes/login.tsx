// GET /login : the demo sign-in form. POST /login : sign an HS256 token into the `token` cookie, 303 to /.
import { setCookie } from 'hono/cookie';
import { createRoute } from 'honox/factory';
import { form } from '../lib/forms';
import { signToken, TOKEN_COOKIE } from '../lib/session';

export const POST = createRoute(form, async (c) => {
  const body = await c.req.parseBody();
  const id = Number(body.user_id);
  const username = String(body.username ?? '').trim();
  if (!Number.isInteger(id) || id < 1 || !username) return c.redirect('/login?error=1', 303);
  setCookie(c, TOKEN_COOKIE, await signToken(id, username), { httpOnly: true, sameSite: 'Lax', path: '/' });
  return c.redirect('/', 303);
});

export default createRoute((c) =>
  c.render(
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
    </form>,
  ),
);
