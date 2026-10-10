import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type Request, type Response } from 'express';
import { join } from 'node:path';
import { BACKEND_URL, createPost, likePost } from './server/api';
import { readCookie, signToken, TOKEN_COOKIE } from './server/session';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// Host validation (SSRF protection): only these Host names are rendered, others get 400. The build-time list is
// `security.allowedHosts` in angular.json (localhost, 127.0.0.1 and the sim's `web`); NG_ALLOWED_HOSTS
// (comma-separated) adds more at runtime.
const angularApp = new AngularNodeAppEngine();

// ---------------------------------------------------------------------------------------------------------------
// JSON pass-through for the load test (writes go through the frontend). No origin check: k6 sends JSON with a
// bearer token, like the other variants' /api routes.
// ---------------------------------------------------------------------------------------------------------------

app.post('/api/posts', express.text({ type: () => true }), async (req, res) => {
  let body = '';
  try {
    // Strict parse like Request.json(): an empty or non-JSON body is a 400.
    body = String(JSON.parse(typeof req.body === 'string' ? req.body : '').body ?? '');
  } catch {
    res.status(400).json({ error: 'malformed JSON body' });
    return;
  }
  const { status, data } = await createPost(req.get('authorization'), body);
  res.status(status).json(data);
});

app.post('/api/posts/:id/like', async (req, res) => {
  const { status, data } = await likePost(req.get('authorization'), req.params.id);
  res.status(status).json(data);
});

// ---------------------------------------------------------------------------------------------------------------
// Read routes for the browser (client-side navigation and the refresh after an enhanced like/compose). During SSR
// the same URLs are answered in-process by ServerApiBackend (app.config.server.ts), not through these routes.
// The API's status and JSON are passed through unchanged; BACKEND_URL stays on the server.
// ---------------------------------------------------------------------------------------------------------------

async function proxyGet(path: string, res: Response) {
  const r = await fetch(BACKEND_URL + path);
  res.status(r.status).type('application/json').send(await r.text());
}
app.get('/data/feed', (_req, res) => proxyGet('/feed', res));
app.get('/data/posts/:id', (req, res) => proxyGet(`/posts/${encodeURIComponent(req.params.id)}`, res));

// ---------------------------------------------------------------------------------------------------------------
// HTML form endpoints (Angular has no form actions). Plain form posts get a 303 (post/redirect/get); the enhanced
// submit (form-action.ts, `Accept: application/json`) gets JSON.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Same rule as Next.js server actions and the Nuxt variant: a request carrying an Origin header must come from the
 * host it was sent to, else 403. Works over plain http on any host (no configured origin).
 */
function sameOrigin(req: Request, res: Response): boolean {
  const origin = req.get('origin');
  if (!origin) return true;
  let host: string | null = null;
  try {
    host = new URL(origin).host;
  } catch {}
  if (host === req.get('host')) return true;
  res.status(403).type('text/plain').send('Cross-site form submission');
  return false;
}

const wantsJson = (req: Request) => (req.get('accept') ?? '').includes('application/json');

/** Same-origin path of the page the form was posted from, else `/`. */
function backTo(req: Request): string {
  const referer = req.get('referer');
  if (!referer) return '/';
  try {
    const url = new URL(referer);
    return url.host === req.get('host') ? url.pathname : '/';
  } catch {
    return '/';
  }
}

function respond(req: Request, res: Response, to: string, error: string | null = null) {
  if (wantsJson(req)) res.json(to === '/login' ? { redirect: to } : { error });
  else res.redirect(303, to);
}

const form = express.urlencoded({ extended: false });
const field = (req: Request, name: string) => String((req.body as Record<string, unknown> | undefined)?.[name] ?? '');
const token = (req: Request) => readCookie(req.get('cookie'), TOKEN_COOKIE);

app.post('/actions/like', form, async (req, res) => {
  if (!sameOrigin(req, res)) return;
  const t = token(req);
  if (!t) return respond(req, res, '/login');
  await likePost(`Bearer ${t}`, field(req, 'id'));
  respond(req, res, backTo(req));
});

app.post('/actions/create', form, async (req, res) => {
  if (!sameOrigin(req, res)) return;
  const t = token(req);
  if (!t) return respond(req, res, '/login');
  const { status, data } = await createPost(`Bearer ${t}`, field(req, 'body'));
  if (status !== 201) {
    const error = data.error ?? `error ${status}`;
    return respond(req, res, `/?error=${encodeURIComponent(error)}`, error);
  }
  respond(req, res, '/');
});

// The login page's form posts to its own URL (GET /login is rendered by Angular).
app.post('/login', form, (req, res) => {
  if (!sameOrigin(req, res)) return;
  const id = Number(field(req, 'user_id'));
  const username = field(req, 'username').trim();
  if (!Number.isInteger(id) || id < 1 || !username) return res.redirect(303, '/login?error=1');
  res.cookie(TOKEN_COOKIE, signToken(id, username), { httpOnly: true, sameSite: 'lax', path: '/' });
  res.redirect(303, '/');
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * HOST/PORT default to 127.0.0.1:3000 like the other variants (the generated file only read PORT, default 4000,
 * and listened on all interfaces). The Dockerfile sets HOST=0.0.0.0.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const host = process.env['HOST'] || '127.0.0.1';
  const port = Number(process.env['PORT'] || 3000);
  app.listen(port, host, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://${host}:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
