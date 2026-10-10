# express: Express 5 + EJS, plain JavaScript, server-rendered on every request, no caching

The "no frontend framework" Node baseline. Same pages, markup, classes and CSS as `../sveltekit`, `../flask` and
`../rust-axum` (`../SPEC.md`, `../shared/styles.css`). Every page request calls the API with Node's `fetch` and renders
fresh HTML from an EJS template; nothing is cached. One Node process, no cluster, no compression. **The pages ship zero
JS**: likes, new posts and sign-in are plain HTML forms that post to Express routes and get a `303` back
(Post/Redirect/Get), like the Flask and Rust variants.

Plain JavaScript ES modules: no TypeScript, no bundler, no build step. `node server.js` runs the source as written.

Versions (exact pins in `package.json`, `pnpm-lock.yaml` committed): Node **24** (`node:24-bookworm-slim`, 24.21.0 when
checked; 24.5.0 on the host), **express 5.3.0** (npm `latest`; released 2026-10-09, the previous 5.x was 5.2.1),
**ejs 7.0.1** (npm `latest`, 2026-10-04), pnpm 10.8.0 (`packageManager`, via corepack). Those two are the only direct
dependencies; express brings 64 transitive packages (body-parser, router, send, serve-static, etag, fresh, cookie, qs,
...), EJS none. No cookie-parser: the app reads one cookie, which takes ten lines (`lib/session.js`), and Express's
`res.cookie` (built in) sets it.

| Piece | File | Notes |
|---|---|---|
| App: middleware, routes, startup | `server.js` | ~150 lines |
| API client (uncached `fetch`) | `lib/api.js` | `getFeed`, `getPost`, `createPost`, `likePost`; `encodeURIComponent` for ids |
| Demo login token + cookie reading | `lib/session.js` | `node:crypto` HMAC; same HS256 header/payload JSON as `sveltekit/src/lib/server/session.ts` |
| Date text | `server.js` (`app.locals.formatDate`) | one `Intl.DateTimeFormat("en", {dateStyle:"medium", timeStyle:"short", timeZone:"UTC"})` per process, + `" UTC"` |
| Layout (header with `@username` or "Sign in") | `views/partials/top.ejs`, `bottom.ejs` | EJS has no layouts; each page includes the top and bottom partials |
| Post card | `views/partials/post.ejs` | included with `link: true` (feed) or `link: false` (post page) |
| Feed `/`, post `/posts/:id`, `/login`, 404 | `views/index.ejs`, `post.ejs`, `login.ejs`, `404.ejs` | |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`, served by `express.static` at `/styles.css` |

## Routes

| Route | What it does |
|---|---|
| `GET /` | `GET {BACKEND_URL}/feed`, renders header, compose form (with the `?error=` message if any), "Latest", 20 posts |
| `GET /posts/:id` | `GET {BACKEND_URL}/posts/:id`; API 404/400 → the 404 page with status **404** |
| `GET /login` | the sign-in form |
| `POST /login` | form → signs `{"sub":"<id>","username":"<name>","iat":..,"exp":..+7d}` with `JWT_SECRET`, sets the `token` cookie (`Path=/; HttpOnly; SameSite=Lax`), 303 to `/` (bad input → `/login?error=1`) |
| `POST /actions/like` | form (`id`) → `POST /posts/:id/like` with `Authorization: Bearer <token cookie>`, 303 back to the Referer's path (same host) or `/` |
| `POST /actions/create` | form (`body`) → `POST /posts`; 303 to `/`, or to `/?error=<API message>` (e.g. "body is required") |
| `POST /api/posts` | JSON passthrough: raw body (`express.raw`, any content type) parsed strictly with `JSON.parse`, sends `{"body": String(x.body ?? "")}`; invalid JSON, empty body or `null` → 400 `{"error":"malformed JSON body"}` |
| `POST /api/posts/:id/like` | JSON passthrough |
| `GET /styles.css` | `express.static` |
| anything else | the 404 page, status 404 (header still shows the signed-in user) |

The form routes redirect to `/login` when there is no `token` cookie. The JSON routes forward the incoming
`Authorization` header as-is (or none) and return the API's status and body bytes unchanged
(`Content-Type: application/json; charset=utf-8`); they are not re-serialized. If the API is down or returns an
unexpected status on a page, the async handler throws, Express 5 forwards the rejection to the error handler, and the
response is a plain 500 (logged).

**Origin check.** Express has no CSRF/origin protection of its own, so the form routes (`/login`, `/actions/*`) apply
the same rule as the Flask and Rust variants (and Next.js server actions): if an `Origin` header is present, its
`host[:port]` must equal the `Host` header (case-insensitive), otherwise **403** "Cross-site form submission".
`Origin: null` is rejected; requests without `Origin` pass. No configuration needed for `localhost`, `127.0.0.1` or the
sim's IP. The `/api/*` JSON routes are not checked.

## How it renders

Per request, Express runs a short middleware chain: the router matches the path (Express 5's `router` 2 with
`path-to-regexp` 8), a small middleware reads the `token` cookie and decodes the JWT payload into `res.locals.username`,
then the route handler `await`s one `fetch` to the API and calls `res.render(view, data)`. Form routes add
`express.urlencoded` (and the Origin check) before the handler; `/api/posts` adds `express.raw`. `express.static` is
mounted **after** the routes, so page requests don't first pay a `fs.stat` for a file in `public/` (a common
tutorial order puts it first; this one is equally idiomatic and keeps static lookups off the page path).

- **EJS compiles each template to a JavaScript function once.** With `NODE_ENV=production`, Express enables
  `view cache`: the view lookup is cached and `cache: true` is passed to EJS, which keeps the compiled function per
  file (included partials too). That caches template *code*, not data or HTML. Without `NODE_ENV=production`, every
  render re-reads and recompiles the template files.
- **A render is string concatenation.** The compiled function appends literal chunks and `escapeXML`-escaped values
  (`<%= %>`: `& < > " '` → `&amp; &lt; &gt; &#34; &#39;`) to one string. The post card is an `include()` called once per
  post (20 calls on the feed), each a call to the cached compiled partial with merged locals.
- **Not streamed.** `res.render` produces the whole page, then `res.send` sets `Content-Length`, so a missing post is a
  real 404.
- **ETag and 304.** Express's default `etag` setting (`weak`) hashes every response body it sends with `res.send`
  (SHA-1 of the body, via the `etag` package) and sets `ETag: W/"<len>-<hash>"`. If the request's `If-None-Match`
  matches (`req.fresh`), Express replaces the response with `304 Not Modified` and no body. The page is still fetched and
  rendered first: it saves bytes on the wire, not work, and is not a cache. Browsers revalidate with it; k6 doesn't send
  `If-None-Match`, so in the load test it only adds the hash per page.
- **Data.** Node's built-in `fetch` (undici) uses a global dispatcher that pools keep-alive connections to the API, so
  requests reuse sockets. No request timeout, like the other JS variants' `fetch`.

## Process model

One Node process, one event loop, one JS thread. While a request awaits the API, the loop serves other requests;
rendering and ETag hashing are synchronous CPU work on that thread, so at most one page renders at a time. No
`cluster`, no worker threads (that's also what the other Node variants do: `node build`, `next start`, ...). On the
simulated 1-vCPU server, a second process would compete for the same CPU quota.

- **Keep-alive.** The server keeps Node's defaults: `keepAliveTimeout` 5 s (`Keep-Alive: timeout=5`), `headersTimeout`
  60 s, `requestTimeout` 300 s. None of the other Node variants change them either. TCP_NODELAY is Node's default.
- **SIGTERM.** As PID 1 in Docker, Node ignores SIGTERM unless the app handles it, so `server.js` closes the listener
  and exits on SIGTERM/SIGINT (`docker stop` takes ~0.3 s instead of the 10 s SIGKILL timeout).
- **Memory.** Measured in a `node:24-bookworm-slim` container: about 76 MB RSS idle right after start, about 98 MB
  RSS after 50 feed renders (V8 heap growth; `docker stats` showed ~41 MiB, which excludes file-backed pages).

## Differences from the framework variants

- **No hydration, zero JS.** No framework runtime, no component tree, no serialized page data, no `<script>` at all.
  The forms are plain `<form method="post">`, so there is no "Posting…" pending state (like Flask, Rust and Astro).
  It is the baseline: what remains of an SSR request in Node when the framework is removed is routing, one `fetch`,
  template string building and `res.send`.
- **Payload.** Feed page ~10.5–12 KB depending on the newest posts (10,555 and 12,114 bytes measured), post page ~1.0 KB (identical structure to the Flask and Rust output, except EJS's
  `&#34;`/`&#39;` escapes). The stylesheet is a separate file (`/styles.css`, 3,789 bytes, `Cache-Control: public,
  max-age=0` with `ETag` and `Last-Modified` from `serve-static`). SvelteKit's feed page is ~16–19 KB, Next.js ~46 KB.
- **Page headers:** `Content-Type: text/html; charset=utf-8`, `Content-Length`, `ETag: W/"..."`, `Date`,
  `Connection: keep-alive`, `Keep-Alive: timeout=5`. No `Cache-Control`, no `Content-Encoding` (no compression
  middleware; the other Node variants except Next.js don't compress in-process either), no chunked encoding.
  `X-Powered-By` is disabled.
- **Real 404s** for a missing or invalid post id and for unknown paths.

## Build and run

```bash
pnpm install
NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge \
  node server.js            # or: pnpm start
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`). Always set `NODE_ENV=production` outside development
(the Dockerfile does), otherwise EJS recompiles templates on every render.

The Dockerfile is one stage on `node:24-bookworm-slim` (+ `iproute2`): `pnpm install --prod --frozen-lockfile` via
corepack, copies `server.js`, `lib/`, `views/` and `public/`, applies the optional `NET_DELAY` with `tc netem`, then
`exec node server.js` on `0.0.0.0:3000`. The healthcheck is the same `fetch` one-liner as the SvelteKit variant.
