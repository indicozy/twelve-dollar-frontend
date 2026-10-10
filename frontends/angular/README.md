# angular — Angular 22 SSR (`@angular/ssr`, Express), server-rendered, no caching

The Angular twin of `../nextjs`, `../sveltekit` and `../nuxt`: same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`), every page rendered on every request from a fresh API call, one Node process: the
CLI-generated Express server (`src/server.ts`, built to `dist/angular/server/server.mjs`). Every server route is
`RenderMode.Server`; nothing is prerendered and nothing is cached.

Versions: @angular/{core,common,router,platform-browser,platform-server,compiler} 22.2.2, @angular/ssr 22.2.2,
@angular/build + @angular/cli 22.2.2 (esbuild 0.28 / Vite 8 underneath), express 5.2.1, rxjs 7.8.2, typescript 6.0.3.
Scaffolded with `ng new --ssr --zoneless --minimal --view-encapsulation None --package-manager pnpm` (pnpm 10.8 works
cleanly with the CLI). Angular CLI 22 needs Node `^22.22.3 || ^24.15 || >=26`; the Docker image
(`node:24-bookworm-slim`) has it.

| Piece | File | Notes |
|---|---|---|
| Express server: SSR handler, form endpoints, JSON pass-through, read routes | `src/server.ts` | the generated file plus routes; listens on `HOST`/`PORT` |
| API client for the write routes (server-only) | `src/server/api.ts` | same functions as the other variants |
| Demo login token, cookie reading | `src/server/session.ts` | same HS256 payload as the other variants |
| Page data (resolvers, HttpClient) | `src/app/data.ts` | `GET /data/feed`, `GET /data/posts/:id`; see "How it renders" |
| SSR-only HttpClient backend | `src/app/app.config.server.ts` | `/data/<path>` → `BACKEND_URL/<path>` in-process |
| Routes / server routes | `src/app/app.routes.ts`, `src/app/app.routes.server.ts` | all `RenderMode.Server`; `**` has `status: 404` |
| Layout + header (`@username` / Sign in) | `src/app/app.ts`, `src/app/session.ts` | name read from the `token` cookie via `REQUEST` on the server, sent to the browser in TransferState |
| Feed `/` | `src/app/pages/feed.ts` | compose form + 20 posts |
| Post `/posts/:id` | `src/app/pages/post.ts` | real **404** for missing or invalid ids (`RESPONSE_INIT`) |
| Post card | `src/app/post-card.ts` | selector `article.post`, so the host element *is* the `<article class="post">` |
| Like/compose enhancement | `src/app/form-action.ts` | optional JS on top of the plain HTML forms |
| Login, not found | `src/app/pages/login.ts`, `src/app/pages/not-found.ts` | |
| Styles | `src/styles.css` | `../shared/styles.css` verbatim, global (no component styles) |

## How it renders

1. `AngularNodeAppEngine.handle()` turns the Node request into a `Request`, validates the `Host` header (see below),
   matches the server route (`RenderMode.Server`) and bootstraps a fresh application per request on the server
   platform (`@angular/platform-server`), with `REQUEST`, `RESPONSE_INIT` and `REQUEST_CONTEXT` provided.
2. The router runs the route's resolver. `HttpClient.get('/data/feed')` passes the interceptors (the transfer-cache
   interceptor records the request under the relative URL), then reaches `ServerApiBackend`, which sends it straight
   to `BACKEND_URL/feed` with `fetch`. No HTTP hop back into this server, one API call per page.
3. The components render into Domino (a server-side DOM emulation). When the app is stable (zoneless: no pending
   tasks/navigation/HTTP), the DOM is serialized to a string with hydration annotations, then Beasties applies the
   build-time critical-CSS plan, and the whole page is sent. The status comes from `RESPONSE_INIT` (set by the post
   resolver) or the server route's `status` (`**` → 404).
4. In the browser, `main-*.js` (zoneless, about 275 KB raw / 76 KB transferred) hydrates the existing DOM instead of
   re-creating it. The first navigation's resolver finds `/data/feed` in the transfer cache, so the browser makes no
   data request. Later reads (client-side navigation via `routerLink`, the refresh after an enhanced like) go to
   `/data/...` on this server, which proxies the API's GET routes. The browser never sees `BACKEND_URL`.

What hydration adds to the HTML (production build, measured):

- `<script id="ng-state" type="application/json">`: TransferState. Holds the **transfer cache** (the full API
  response body, status, URL `/data/feed`, keyed by a hash of method + URL + body + params), the signed-in username,
  and `__nghData__` (the DOM-structure annotations hydration uses to match nodes). On `/` it is about 4.0 KB, of
  which about 3.75 KB is the feed JSON (the posts appear twice: once as HTML, once as JSON) and about 0.27 KB is
  `__nghData__`. On `/posts/250000` it is about 0.6 KB.
- `ngh="…"` attributes on component hosts, `<!---->` container comments, `<!--nghm-->`, `ng-version` and
  `ng-server-context="ssr"` on `<app-root>`.
- **Event replay** (enabled by the default incremental hydration): an inline `ng-event-dispatch-contract` script plus
  a `__jsaction_bootstrap` call (about 0.55 KB), and `jsaction="submit:;"` / `jsaction="click:;"` on elements with
  listeners, so a click or submit before hydration is replayed afterwards.
- **Critical CSS** (Angular's production default `inlineCritical`): the rules the page uses are inlined in a
  `<style>`, and the stylesheet link is loaded non-blocking (`media="print"` swap + `<noscript>` fallback). About
  2.0–2.8 KB per page. The rules are planned at build time; at runtime the per-request cost was not measurable
  (feed page about 9 ms per sequential request either way on this machine). Set
  `optimization.styles.inlineCritical: false` in `angular.json` to send a plain `<link rel="stylesheet">` like the
  other variants.
- No `ng-reflect-*` (dev only) and no `_ngcontent-*`/`_nghost-*` (no component styles, `ViewEncapsulation.None`
  default). The post markup is literally `<article class="post" data-post-id="250000" ngh="0">`, links are
  `href="/posts/<id>"`.

Zoneless: no zone.js anywhere (the default since Angular 21); change detection is driven by signals.

## Mutations

Angular has no form actions or server actions, so (like Nuxt) writes go through server routes in `src/server.ts`
plus plain HTML forms:

- Without JS, the like and compose forms POST (urlencoded) to `/actions/like` and `/actions/create`. The server
  forwards the `token` cookie as `Authorization: Bearer …` and answers `303`: back to the posting page (same-origin
  `Referer`), to `/login` when signed out, or to `/?error=…` when a post is rejected. `POST /login` (the login page
  posts to its own URL) signs the demo token and sets the httpOnly, `SameSite=Lax` cookie.
- With JS, `FormAction` posts the same form with `fetch` (`Accept: application/json`, urlencoded body), then
  re-runs the current route's resolver (`onSameUrlNavigation: 'reload'`, `runGuardsAndResolvers: 'always'`), which
  refetches `/data/...`.
- **Origin check**: Express has no CSRF protection, so the form endpoints apply the Next.js server-action rule (same
  as the Nuxt variant): if an `Origin` header is present, its host must equal the `Host` header, else 403. Nothing is
  configured at build or run time, so forms work over plain http on any allowed host. The JSON routes are not
  checked.
- JSON pass-through for the load test: `POST /api/posts` (body parsed strictly with `JSON.parse`, else 400
  `{"error":"malformed JSON body"}`; then `{"body": …}` is sent) and `POST /api/posts/:id/like`. Both forward the
  incoming `Authorization` header as-is and return the API's status and JSON.

## Differences from the other variants

- **No streaming.** Angular renders the whole page before sending anything (no skeletons, no Suspense-like
  fallbacks). The body goes out through a `ReadableStream` with one chunk, so the response is
  `Transfer-Encoding: chunked` without `Content-Length`. Sizes: `/` about **19.4 KB** (Next.js about 46 KB,
  SvelteKit 16–19 KB, Nuxt 15.4 KB), `/posts/250000` about **5.0 KB**, the 404 pages about 3.4–3.5 KB, `/login`
  4.2 KB. Without critical-CSS inlining the feed page is about 16.7 KB and the post page about 2.75 KB.
- **Payload duplication**: the transfer cache embeds the raw API JSON (about 3.75 KB for 20 posts), not deduplicated.
- **No ETag** on rendered pages and no `cache-control` header (Angular sets an ETag only for prerendered pages).
  Static files from `express.static` get `Cache-Control: public, max-age=31536000` and a weak ETag.
- **No compression.** The generated `server.ts` does not use `compression`, and neither does this variant.
- **`X-Powered-By: Express`** is sent (generated-server default).
- **404s are real.** Unknown paths (`**` server route with `status: 404`), missing posts (`/posts/999999999`, API 404)
  and invalid ids (`/posts/abc`, API 400) all give 404 with the not-found page inside the normal layout. For a missing
  post the browser refetches `/data/posts/:id` on hydration (error responses are not put in the transfer cache).
- **Host validation.** `@angular/ssr` rejects requests whose `Host` (or `X-Forwarded-Host`) is not allowed, with a
  400 and a logged error (SSRF protection; there is no implicit localhost default). `angular.json`
  `security.allowedHosts` is `["localhost", "127.0.0.1", "web"]` (the sim reaches the container as `web:3000`). Add
  more at runtime with `NG_ALLOWED_HOSTS=a,b` (comma-separated, merged with the build-time list). Proxy headers
  (`X-Forwarded-*`) are ignored unless `NG_TRUST_PROXY_HEADERS` is set.

## Build and run

```bash
pnpm install && pnpm build          # ng build (production); the build runs the TypeScript/template type check
BACKEND_URL=http://127.0.0.1:4000 HOST=127.0.0.1 PORT=3000 node dist/angular/server/server.mjs
```

The server bundle includes Express and Angular and imports only `node:` builtins, so `dist/` is the whole runtime
artefact (about 2.2 MB); the Docker runtime stage copies only that and `package.json`. Env: `BACKEND_URL` (default
`http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT` (default
`127.0.0.1:3000`; the generated server only read `PORT`, default 4000, on all interfaces), `NG_ALLOWED_HOSTS`.
The Dockerfile sets `0.0.0.0:3000`.
