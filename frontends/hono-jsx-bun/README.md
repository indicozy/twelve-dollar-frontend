# hono-jsx-bun: Hono 4 + hono/jsx on Bun, server-rendered on every request, no caching

The same app as `../express` (pages, markup, classes, forms, JSON passthrough routes; `../SPEC.md`,
`../shared/styles.css`) written the idiomatic Hono way: routes on a `Hono` app, views as **`hono/jsx` components**
rendered to a string through the built-in `jsxRenderer` middleware, Hono's own cookie, JWT and CSRF helpers, served by
**Bun** (`Bun.serve`). Every page request calls the API with Bun's `fetch` and renders fresh HTML; nothing is cached.
One Bun process. **The pages ship zero JS**: no hydration, no client components, no `<script>`; likes, new posts and
sign-in are plain HTML forms that post to Hono routes and get a `303` back (Post/Redirect/Get).

`../hono-jsx-node` runs the **identical `src/`** (only `src/index.tsx`, the entrypoint, differs) on Node 24 via
`@hono/node-server`, so the pair isolates the runtime (Bun vs Node) with the same framework code and byte-identical
HTML. Comparing with `../express` compares Hono JSX with Express + EJS on the same runtime family.

Versions (exact pins in `package.json`, `bun.lock` committed, `bunfig.toml` `exact = true`): **Bun 1.4.3**
(`oven/bun:1.4.3-slim`, latest stable, released 2026-10-10), **hono 4.13.13** (npm `latest`, 2026-10-04; `next` is
5.0.0-rc.1, not used). Hono is the only runtime dependency and has no dependencies of its own; `@types/bun` 1.4.2 is
dev-only (type checking).

| Piece | File | Notes |
|---|---|---|
| App: middleware, routes, error/404 handlers | `src/app.tsx` | runtime-agnostic `Hono` app, shared verbatim with `../hono-jsx-node` |
| Entrypoint | `src/index.tsx` | `serveStatic` from `hono/bun`, `Bun.serve({ hostname, port, fetch: app.fetch })`, SIGTERM handler |
| API client (uncached `fetch`) | `src/lib/api.ts` | same as `../express/lib/api.js`, typed |
| Demo login token, cookie username | `src/lib/session.ts` | `sign`/`decode` from `hono/jwt` (HS256, WebCrypto); same payload `{sub, username, iat, exp}` |
| Layout (header with `@username` or "Sign in") | `src/views/Layout.tsx` | used by `jsxRenderer`, which prepends `<!DOCTYPE html>` |
| Post card | `src/views/PostCard.tsx` | `link` prop: feed links to `/posts/:id`, post page shows `<span class="muted">`; date formatter |
| Feed, post, login, 404 | `src/views/pages.tsx` | `FeedPage`, `PostPage`, `LoginPage`, `NotFoundPage` |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`, served by `serveStatic` at `/styles.css` |

## Routes

Same table as `../express/README.md`: `GET /`, `GET /posts/:id` (API 404/400 → 404 page, status **404**), `GET /login`,
`POST /login` (sets `token` cookie `Path=/; HttpOnly; SameSite=Lax`, 303 to `/`; bad input → `/login?error=1`),
`POST /actions/like` (303 back to the same-host Referer path, or `/`), `POST /actions/create` (303 to `/` or
`/?error=<API message>`), `POST /api/posts` (body read with `c.req.text()`, strict `JSON.parse`, invalid/empty/`null` →
400 `{"error":"malformed JSON body"}`), `POST /api/posts/:id/like`, `GET /styles.css`, and the 404 page (status 404,
header still shows the signed-in user) for anything else. Form routes redirect to `/login` without a `token` cookie.
The `/api/*` routes forward `Authorization` as-is and return the API's status and body bytes unchanged
(`Content-Type: application/json; charset=utf-8`). An API failure on a page throws; `app.onError` logs it and returns a
plain 500.

**Origin check: Hono's built-in `csrf()` middleware** on the form routes (`/login`, `/actions/*`). It differs from
Express's hand-written rule in one case: a form-encoded POST passes only if `Sec-Fetch-Site: same-origin` **or**
`Origin` equals the request URL's origin; a form POST with **neither header is rejected (403)**, where Express lets it
through. Browsers always send `Origin` on form posts, so real users see no difference; `curl` form posts need
`-H "Origin: http://host:port"`. The load test only writes through `/api/*`, which is not checked.

## How it renders

Per request: Hono's router (`SmartRouter`, which settles on `RegExpRouter` for these static/param routes) matches the
path; a middleware reads the `token` cookie (`getCookie`) and decodes the JWT payload into `c.var.username`;
`jsxRenderer` installs the layout; the handler `await`s one `fetch` and calls `c.render(<Page …/>)`.

- **JSX is compiled away by Bun's transpiler** (`jsx: react-jsx`, `jsxImportSource: hono/jsx` in `tsconfig.json`)
  when the module first loads: every element becomes a `jsx()` call creating a lightweight `JSXNode`. There is no
  virtual DOM diffing, no component state, no hooks used.
- **Rendering builds a string.** `c.render` wraps the tree in `html\`<!DOCTYPE html>${…}\``; `JSXNode#toString`
  walks the tree and appends tags, attributes and escaped text (`& < > "` → `&amp; &lt; &gt; &quot;`) to a string
  buffer. Function components (the post card is called 20 times on the feed) are plain function calls. Because the
  tree contains no async components, the result is a plain string and `c.html()` sends it with `Content-Length`.
- **Not streamed** (`jsxRenderer`'s `stream` option is off, the default), so a missing post is a real 404.
- **Output shape.** JSX discards source whitespace between tags, void elements are written `<meta …/>`, boolean
  attributes `required=""`. After normalizing those (and the title/stack label) the HTML is identical to Express's.
  Feed page ~11.1–11.7 KB (Express: ~11.3–11.8 KB on the same data), post page ~1.15 KB, 404 568 B.
- **No ETag.** Hono adds none unless you add the `etag` middleware (Express hashes every body by default). No
  compression, no `Cache-Control` on pages.
- **Data.** Bun's `fetch` keeps a keep-alive connection pool to the API. No request timeout.

## Process model

One Bun process (Bun's default; no `reusePort` cluster, no workers). JavaScriptCore runs the JS on one thread; Bun's
HTTP server is native (uWebSockets-based) code on the same event loop.

- **Keep-alive.** `Bun.serve` defaults: HTTP/1.1 keep-alive, `idleTimeout` 10 s (Node's is 5 s), no `Keep-Alive`
  response header.
- **Page headers:** `Content-Type: text/html; charset=UTF-8`, `Content-Length`, `Date`. No `ETag`, no `X-Powered-By`.
- **SIGTERM.** As PID 1 in Docker Bun does not exit on SIGTERM by itself (`docker stop` took 10.6 s), so
  `src/index.tsx` stops the server and exits on SIGTERM/SIGINT (`docker stop` ~0.45 s).
- **Memory.** In the container: ~47 MB RSS idle right after start, ~60 MB after 50 feed renders (Node variant: ~116 MB).

## Build and run

```bash
bun install --frozen-lockfile
NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge \
  bun run src/index.tsx          # or: bun run start
```

No build step: Bun runs the TypeScript/TSX source directly, transpiling each file once at load (that is Hono's
documented Bun setup). Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default
`twelve-dollar-challenge`), `HOST`/`PORT` (default `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`). `NODE_ENV`
only affects the log line; hono/jsx has no dev/prod rendering difference.

The Dockerfile is one stage on `oven/bun:1.4.3-slim` (Debian, + `iproute2`): `bun install --production
--frozen-lockfile`, copies `src/` and `public/`, applies the optional `NET_DELAY` with `tc netem`, then
`exec bun run src/index.tsx` on `0.0.0.0:3000`. The healthcheck is the same `fetch` one-liner as the Node variants,
run with `bun -e` (the image has no curl). Image `perf-hono-jsx-bun`, 181 MB. Run in the sim with
`FRONTEND=hono-jsx-bun`.
