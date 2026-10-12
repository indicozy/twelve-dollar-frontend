// Hono + hono/jsx variant of the SSR feed app (see ../../SPEC.md). Runtime-agnostic: the entrypoint (index.tsx) adds
// static files and starts the server. Every page is rendered on every request from a fresh API call; nothing is
// cached. Views are JSX components rendered to a string (no client JS, no hydration).
import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { jsxRenderer } from 'hono/jsx-renderer';
import { createPost, getFeed, getPost, likePost } from './lib/api.js';
import { currentUsername, signToken, TOKEN_COOKIE } from './lib/session.js';
import { Layout } from './views/Layout.js';
import { FeedPage, LoginPage, NotFoundPage, PostPage } from './views/pages.js';

type Env = { Variables: { token: string | undefined; username: string | null } };

export const app = new Hono<Env>();

// The token cookie and the signed-in name, read per request (the header shows @username).
app.use(async (c, next) => {
  const token = getCookie(c, TOKEN_COOKIE) || undefined;
  c.set('token', token);
  c.set('username', currentUsername(token));
  await next();
});

// Layout for c.render(): <!DOCTYPE html> + the page shell, rendered to one string (stream: false, the default).
app.use(jsxRenderer(({ children }, c) => <Layout username={c.get('username')}>{children}</Layout>));

// ---------------------------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------------------------
app.get('/', async (c) => {
  // A rejected post comes back as /?error=... (Post/Redirect/Get), like the Express and Flask variants.
  const error = c.req.query('error') ?? null;
  return c.render(<FeedPage posts={await getFeed()} error={error} />);
});

app.get('/posts/:id', async (c) => {
  const post = await getPost(c.req.param('id'));
  // The whole page renders before anything is sent, so a missing post is a real 404.
  if (!post) {
    c.status(404);
    return c.render(<NotFoundPage />);
  }
  return c.render(<PostPage post={post} />);
});

app.get('/login', (c) => c.render(<LoginPage />));

// ---------------------------------------------------------------------------------------------------------------
// HTML form routes (plain form posts, Post/Redirect/Get), behind Hono's built-in CSRF middleware: a form-encoded
// POST passes only if Sec-Fetch-Site is "same-origin" or Origin equals the request URL's origin, else 403.
// The JSON routes under /api are not checked.
// ---------------------------------------------------------------------------------------------------------------
const form = csrf();

/** Same-origin path of the page the form was posted from, else /. */
function backTo(referer: string | undefined, host: string | undefined): string {
  const m = /^https?:\/\/([^/?#]+)/i.exec(referer ?? '');
  if (referer && m && m[1].toLowerCase() === (host ?? '').toLowerCase()) {
    const path = referer.slice(referer.indexOf('//') + 2 + m[1].length).split(/[?#]/)[0];
    return path.startsWith('/') ? path : '/';
  }
  return '/';
}

app.post('/login', form, async (c) => {
  const body = await c.req.parseBody();
  const id = Number(body.user_id);
  const username = String(body.username ?? '').trim();
  if (!Number.isInteger(id) || id < 1 || !username) return c.redirect('/login?error=1', 303);
  setCookie(c, TOKEN_COOKIE, await signToken(id, username), { httpOnly: true, sameSite: 'Lax', path: '/' });
  return c.redirect('/', 303);
});

app.post('/actions/create', form, async (c) => {
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

app.post('/actions/like', form, async (c) => {
  const token = c.get('token');
  if (!token) return c.redirect('/login', 303);
  const body = await c.req.parseBody();
  const r = await likePost(`Bearer ${token}`, String(body.id ?? ''));
  await r.body?.cancel();
  return c.redirect(backTo(c.req.header('referer'), c.req.header('host')), 303);
});

// ---------------------------------------------------------------------------------------------------------------
// JSON passthrough for the load test: forward Authorization as-is, return the API's status and JSON body unchanged.
// ---------------------------------------------------------------------------------------------------------------
const passthrough = async (r: Response) =>
  new Response(await r.arrayBuffer(), {
    status: r.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

app.post('/api/posts', async (c) => {
  let body: string;
  try {
    // Strict parse of the raw body; `null` or an empty body throw too.
    body = String(JSON.parse(await c.req.text()).body ?? '');
  } catch {
    return c.json({ error: 'malformed JSON body' }, 400);
  }
  return passthrough(await createPost(c.req.header('authorization'), body));
});

app.post('/api/posts/:id/like', async (c) =>
  passthrough(await likePost(c.req.header('authorization'), c.req.param('id'))),
);

// Unknown paths (after the entrypoint's static files): the 404 page (header still shows the signed-in user).
app.notFound((c) => {
  c.status(404);
  return c.render(<NotFoundPage />);
});

// API down or unexpected status on a page: a plain 500 (logged). HTTPExceptions (the CSRF 403) keep their response.
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.text('Internal Server Error', 500);
});
