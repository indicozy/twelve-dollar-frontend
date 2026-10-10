# qwik: Qwik City 1.20 (Qwik 1.20), server-rendered, no caching

The Qwik City twin of `../nextjs` and `../sveltekit`: same pages, markup and CSS (`../SPEC.md`, `../shared/styles.css`
copied verbatim to `src/global.css`), every page rendered on every request from a fresh API call, one Node process
using Qwik City's official **node-server** adapter (plain `node:http`, no Express).

Versions (pinned): `@builder.io/qwik` 1.20.2, `@builder.io/qwik-city` 1.20.2 (latest stable; Qwik 2 /
`@qwik.dev/router` is still a release candidate), vite 7.3.7 (Qwik 1 requires vite < 8), typescript 6.0.3, Node 24.

| Piece | File | Notes |
|---|---|---|
| API client (server-only, uncached `fetch`) | `src/lib/server/api.ts` | same functions as the other variants |
| Demo login token + cookie reading | `src/lib/server/session.ts` | same HS256 payload as `sveltekit/src/lib/server/session.ts` |
| Form actions `like`, `create` | `src/lib/actions.ts` | `routeAction$`, re-exported by the route files that render the forms |
| Post markup | `src/components/post-card.tsx` | inline component (no `component$` boundary per card) |
| Header with signed-in name | `src/routes/layout.tsx` | `routeLoader$` reads the `token` cookie per request |
| Feed `/` | `src/routes/index.tsx` | `routeLoader$` calls `GET /feed`; compose `<Form>` |
| Post `/posts/[id]` | `src/routes/posts/[id]/index.tsx` | real **404** for missing or invalid ids |
| Login | `src/routes/login/index.tsx` | `routeAction$` signs the demo token, sets the httpOnly `token` cookie, 303 to `/` |
| Not found (any other path) | `src/routes/[...rest]/index.tsx` | catch-all page, status 404, rendered per request |
| JSON passthrough for the load test | `src/routes/api/posts/index.ts`, `src/routes/api/posts/[id]/like/index.ts` | `onPost`, forwards `Authorization` |
| Server | `src/entry.node-server.tsx`, `adapters/node-server/vite.config.ts` | adapter starter + `HOST`, `ssg: null` |
| Document shell | `src/root.tsx`, `src/entry.ssr.tsx` | |

## How it renders

- Every request runs the route's `routeLoader$`s on the server (layout: cookie → username; page: `fetch(BACKEND_URL…)`),
  then `renderToStream` renders the whole tree. Nothing is cached: no `onGet`/`cacheControl` (the starters add one,
  it was removed), no `Cache-Control` from vite (the starter's dev/preview headers were removed), and SSG is
  turned off (`nodeServerAdapter({ ssg: null })`), so no page is generated at build time.
- **Resumability instead of hydration.** The browser does not re-run components. The page loads the ~3 KB
  qwikloader (`/build/q-*.js`, one module script that dispatches the inline `on:*` attributes), a preloader with the
  bundle graph,
  and a `<script type="qwik/json">` with the state the listeners might need: the loader values (the 20 posts on the
  feed, ~12–13 KB of the ~35–38 KB page; ~2 KB on the post page), the action stores and the Link handlers. Component
  code (`dist/build/q-*.js`, ~90 KB total, split into 22 chunks) is only fetched when an interaction needs it
  (prefetched in idle time after `load`).
- Likes and new posts use `routeAction$` + `<Form>`. Without JS a form posts `application/x-www-form-urlencoded` to
  `?qaction=<id>` on the current page; the action runs, the page's loaders re-run and the page is rendered in the
  same response (200, or the `fail()` status for a failed create). With JS, Qwik submits the action itself and
  re-runs the loaders. Not signed in → 303 to `/login`.
- Links use `<Link prefetch={false}>` (same as the Next.js variant's `prefetch={false}`; Qwik's default would
  fetch every visible link's loader data).

## Differences from the Next.js / SvelteKit variants worth knowing when comparing

- **Streaming:** `renderToStream` writes the response with `Transfer-Encoding: chunked`, but loaders finish before
  rendering starts, so in practice the page arrives as one render with no skeleton (like SvelteKit, unlike Next.js'
  Suspense streaming). Status codes are therefore real: missing/invalid post and unknown paths are **404** with the
  "Not found" block inside the layout.
- **Payload:** feed page ~35–38 KB uncompressed (~8 KB gzip -9), post page ~9.4 KB, `/login` ~8.5 KB, 404 ~8.2–8.6 KB
  (SvelteKit: feed ~16–19 KB; Next.js: ~46 KB). Qwik adds resumability attributes (`q:key`, `q:id`, `on:click` on
  every `<Link>`, `<!--qv-->` comments) and inlines the 3.4 KB stylesheet into every page (Qwik's default for
  small CSS, instead of a `<link>`).
- **Markup quirks:** Qwik always emits `class` after the other attributes, so cards render as
  `<article data-post-id="1" class="post" q:key="1">` (the load test only needs `data-post-id="…"` and
  `href="/posts/…"`, which are exact). `<time datetime>` and `maxlength` are passed via a spread because Qwik's types
  only accept `dateTime`/`maxLength` and it renders names as typed. The signed-in name renders as
  `@<!--t=6-->name<!---->` (text-binding markers).
- **No ETag**, no 304 (SvelteKit sends one). Response headers for pages: `content-type: text/html; charset=utf-8`,
  `Transfer-Encoding: chunked`, no `cache-control`, no `etag`.
- **No compression** (the node-server adapter doesn't compress; Next.js gzips by default). Static assets in
  `dist/` are served by the adapter without `Cache-Control` (the starter's `immutable` header was left out).
- **Trailing slash:** `qwikCity({ trailingSlash: false })`, so `/posts/1` is served directly (Qwik City's default
  301-redirects to `/posts/1/`, which would add a round trip to every post page in the load test).
- **Origin / CSRF:** Qwik City checks the `Origin` header on every POST/PUT/PATCH/DELETE whose content type is a
  form type, `text/plain` **or missing**, against the server origin. The origin is `ORIGIN` if set, otherwise
  derived per request from the `Host` header (+ http/https). This variant leaves `ORIGIN` unset, so form posts
  work over plain http on both `localhost:3000` and `127.0.0.1:3000` (set `ORIGIN=http://host:port` at runtime to pin
  one; `PROTOCOL_HEADER`/`HOST_HEADER` can point at `X-Forwarded-*` behind a proxy). JSON requests (the load test sends
  `Content-Type: application/json`, also for the bodiless like) are not checked. A bodiless POST **without** a
  content type and without a matching `Origin` gets 403 here, while the other variants accept it.
- **Server bundle:** the adapter bundles everything into `server/` (~700 KB, no runtime `node_modules`). That includes
  `undici`, which Qwik City's Node middleware imports for a fetch polyfill it only installs when `fetch` is
  missing (never on Node 24; the native `fetch` is used). Loading it prints a harmless `SQLite is an experimental
  feature` warning at startup.

## Build / run

```bash
pnpm install && pnpm build          # qwik build: client (dist/), server (server/), tsc type check
pnpm check                          # type check only
BACKEND_URL=http://127.0.0.1:4000 HOST=127.0.0.1 PORT=3000 node server/entry.node-server.js
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1`/`3000`; `0.0.0.0`/`3000` in Docker), optional `ORIGIN`. The Docker image copies only `server/`
and `dist/` (the server serves `../dist` relative to itself).
