// Express 5 + EJS variant of the SSR feed app (see ../SPEC.md). Every page is rendered on every request from a
// fresh API call; nothing is cached. One Node process.
import { join } from 'node:path';
import express from 'express';
import { createPost, getFeed, getPost, likePost } from './lib/api.js';
import { currentToken, currentUsername, signToken, TOKEN_COOKIE } from './lib/session.js';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3000);

const app = express();
// With NODE_ENV=production Express enables 'view cache': each EJS template is compiled to a JS function once and
// reused. That caches template code, not data or HTML. ETag stays at Express's default ('weak').
app.set('view engine', 'ejs');
app.set('views', join(import.meta.dirname, 'views'));
app.disable('x-powered-by');

// Date text: Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"}) + " UTC",
// like the JS variants ("Dec 31, 2025, 11:59 PM UTC"). One formatter for the process.
const fmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
app.locals.formatDate = (iso) => `${fmt.format(new Date(iso))} UTC`;

// The token cookie and the signed-in name, read per request (the header shows @username).
app.use((req, res, next) => {
  req.token = currentToken(req);
  res.locals.username = currentUsername(req.token);
  next();
});

// ---------------------------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------------------------
app.get('/', async (req, res) => {
  // A rejected post comes back as /?error=... (Post/Redirect/Get), like the Flask, Nuxt and Angular variants.
  const error = typeof req.query.error === 'string' ? req.query.error : null;
  res.render('index', { posts: await getFeed(), error });
});

app.get('/posts/:id', async (req, res) => {
  const post = await getPost(req.params.id);
  // The whole page renders before anything is sent, so a missing post is a real 404.
  if (!post) return res.status(404).render('404');
  res.render('post', { post });
});

app.get('/login', (req, res) => res.render('login'));

// ---------------------------------------------------------------------------------------------------------------
// HTML form routes (plain form posts, Post/Redirect/Get). Express has no CSRF/origin protection of its own, so these
// apply the same rule as the Flask/Rust variants (and Next.js server actions): if an Origin header is present, its
// host[:port] must equal the Host header, else 403. The JSON routes under /api are not checked.
// ---------------------------------------------------------------------------------------------------------------
const urlHost = (url) => /^https?:\/\/([^/?#]+)/i.exec(url ?? '')?.[1] ?? null;

function sameOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (origin === undefined) return next();
  const host = urlHost(origin);
  if (!host || host.toLowerCase() !== (req.headers.host ?? '').toLowerCase()) {
    return res.status(403).type('text').send('Cross-site form submission');
  }
  next();
}

/** Same-origin path of the page the form was posted from, else /. */
function backTo(req) {
  const referer = req.headers.referer;
  const host = urlHost(referer);
  if (host && host.toLowerCase() === (req.headers.host ?? '').toLowerCase()) {
    const path = referer.slice(referer.indexOf('//') + 2 + host.length).split(/[?#]/)[0];
    return path.startsWith('/') ? path : '/';
  }
  return '/';
}

const form = [sameOrigin, express.urlencoded({ extended: false })];

app.post('/login', form, (req, res) => {
  const id = Number(req.body?.user_id);
  const username = String(req.body?.username ?? '').trim();
  if (!Number.isInteger(id) || id < 1 || !username) return res.redirect(303, '/login?error=1');
  res.cookie(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: 'lax', path: '/' });
  res.redirect(303, '/');
});

app.post('/actions/create', form, async (req, res) => {
  if (!req.token) return res.redirect(303, '/login');
  const r = await createPost(`Bearer ${req.token}`, String(req.body?.body ?? ''));
  if (r.status !== 201) {
    const data = await r.json().catch(() => ({}));
    return res.redirect(303, `/?error=${encodeURIComponent(data.error ?? `error ${r.status}`)}`);
  }
  await r.body?.cancel();
  res.redirect(303, '/');
});

app.post('/actions/like', form, async (req, res) => {
  if (!req.token) return res.redirect(303, '/login');
  const r = await likePost(`Bearer ${req.token}`, String(req.body?.id ?? ''));
  await r.body?.cancel();
  res.redirect(303, backTo(req));
});

// ---------------------------------------------------------------------------------------------------------------
// JSON passthrough for the load test: forward Authorization as-is, return the API's status and JSON body unchanged.
// ---------------------------------------------------------------------------------------------------------------
async function passthrough(res, r) {
  res.status(r.status).type('application/json').send(Buffer.from(await r.arrayBuffer()));
}

app.post('/api/posts', express.raw({ type: () => true }), async (req, res) => {
  let body;
  try {
    // Strict parse of the raw body; `null` or an empty body throw too, as `(await request.json()).body` does.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    body = String(JSON.parse(raw).body ?? '');
  } catch {
    return res.status(400).json({ error: 'malformed JSON body' });
  }
  await passthrough(res, await createPost(req.headers.authorization, body));
});

app.post('/api/posts/:id/like', async (req, res) => {
  await passthrough(res, await likePost(req.headers.authorization, req.params.id));
});

// /styles.css (verbatim ../shared/styles.css). Mounted after the routes so page requests don't pay serve-static's
// fs.stat lookup first; it only sees paths no route matched.
app.use(express.static(join(import.meta.dirname, 'public')));

// Unknown paths: the 404 page (header still shows the signed-in user).
app.use((req, res) => res.status(404).render('404'));

// Express 5 forwards rejected promises from async handlers here (API down, unexpected status).
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).type('text').send('Internal Server Error');
});

// Node's default keepAliveTimeout (5 s) is kept, as in the other Node variants.
const server = app.listen(PORT, HOST, (err) => {
  if (err) throw err;
  console.log(`express listening on http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
});

// PID 1 in Docker gets SIGTERM on `docker stop`; close the listener and exit instead of waiting for SIGKILL.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
