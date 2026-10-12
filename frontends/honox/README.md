# honox: HonoX (Hono + hono/jsx, file-based routes, one island) on Bun, server-rendered on every request, no caching

The same app as `../hono-jsx-bun` (pages, markup, classes, forms, JSON passthrough routes; `../SPEC.md`,
`../shared/styles.css`) written the idiomatic **HonoX** way: **file-based routes** in `app/routes` (`createRoute`
handlers, `export const POST` for form posts), a `_renderer.tsx` (Hono's `jsxRenderer`), `_middleware.ts`, `_404.tsx`
and `_error.tsx`, views in **`hono/jsx`**, and **one island** (`app/islands/like-button.tsx`) hydrated in the browser
with `hono/jsx/dom`. Built with **Vite** (`vite build --mode client && vite build`) into a single server bundle that
**Bun** serves through `@hono/vite-build`'s Bun adapter. Every page request calls the API with Bun's `fetch` and renders
fresh HTML; nothing is cached. One Bun process.

Comparing with `../hono-jsx-bun` (same runtime, same Hono, same JSX, same API client/JWT/cookie/CSRF code) isolates
what the metaframework adds: HonoX's router composition (one sub-app per route directory, the build adapter's wrapper
app, an `AsyncLocalStorage` context per request), the island wrapper markup and the island `<script>`.

Versions (exact pins in `package.json`, `bun.lock` committed, `bunfig.toml` `exact = true`): **Bun 1.4.3**
(`oven/bun:1.4.3-slim`, same image as `../hono-jsx-bun`), **honox 0.1.62** (npm `latest`, 2026-10-08), **hono
4.13.13** (npm `latest`), **vite 8.3.4** (npm `latest`, Rolldown-based), **@hono/vite-build 1.11.1** (npm `latest`),
`@hono/vite-dev-server` 0.25.3 (dev server adapter only; 0.25.x is the range honox itself depends on, 0.26.1 would
install a second copy), `@types/bun` 1.4.2. Only hono and honox are runtime code, and both are **bundled into
`dist/index.js`**; the runtime image has no `node_modules`.

| Piece | File | Notes |
|---|---|---|
| Server entry | `app/server.ts` | `createApp()` from `honox/server` (globs `app/routes/**`), SIGTERM handler |
| Client entry | `app/client.ts` | `createClient()` from `honox/client`: hydrates every `<honox-island>` |
| Build | `vite.config.ts` | `honox()` plugin + `@hono/vite-build/bun`; `define: {'process.env': 'process.env'}` (HonoX README) so env vars are read at runtime; the adapter's default export is replaced by `{ fetch, hostname: HOST, port: PORT }` so `HOST` works like in `../hono-jsx-bun` |
| Layout (header with `@username` or "Sign in") | `app/routes/_renderer.tsx` | `jsxRenderer`, `<Script src="/app/client.ts" async />` (resolved through `dist/.vite/manifest.json`) |
| Token cookie → `c.var.token`/`username` | `app/routes/_middleware.ts` | runs for every route directory |
| Feed `GET /` | `app/routes/index.tsx` | `getFeed()`, compose form, 20 `PostCard`s |
| Post `GET /posts/:id` | `app/routes/posts/[id].tsx` | `getPost()`; missing/invalid → `c.notFound()` → `_404.tsx` (status 404) |
| Login `GET`/`POST /login` | `app/routes/login.tsx` | form; `POST` signs the HS256 token into the `token` cookie |
| Form actions | `app/routes/actions/create.ts`, `app/routes/actions/like.ts` | `export const POST = createRoute(csrf(), handler)`, 303 Post/Redirect/Get |
| JSON passthrough | `app/routes/api/posts/index.ts`, `app/routes/api/posts/[id]/like.ts` | forward `Authorization` as-is |
| 404 / 500 | `app/routes/_404.tsx`, `app/routes/_error.tsx` | 404 page; plain 500 (logged), `HTTPException` (CSRF 403) keeps its response |
| Post card | `app/components/PostCard.tsx` | same markup as `../hono-jsx-bun/src/views/PostCard.tsx`, the like form is the island |
| **Like button island** | `app/islands/like-button.tsx` | the only client component (see below) |
| API client, session | `app/lib/api.ts`, `app/lib/session.ts` | verbatim copies of `../hono-jsx-bun/src/lib/` |
| CSRF, back-to-referer, passthrough helpers | `app/lib/forms.ts` | moved out of `../hono-jsx-bun/src/app.tsx` unchanged |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`; Vite copies it to `dist/styles.css` |

## Routes

Identical to `../hono-jsx-bun/README.md`: `GET /`, `GET /posts/:id` (API 404/400 → 404 page, status **404**),
`GET /login`, `POST /login` (`token` cookie `Path=/; HttpOnly; SameSite=Lax`, 303 to `/`; bad input →
`/login?error=1`), `POST /actions/like` (303 back to the same-host Referer path, or `/`), `POST /actions/create` (303 to
`/` or `/?error=<API message>`), `POST /api/posts` (strict `JSON.parse`, invalid/empty/`null` → 400
`{"error":"malformed JSON body"}`), `POST /api/posts/:id/like`, `GET /styles.css`, the 404 page for anything else.
Form routes redirect to `/login` without a `token` cookie and sit behind Hono's built-in `csrf()` (a form POST without
`Origin`/`Sec-Fetch-Site: same-origin` gets 403; `curl` needs `-H "Origin: http://host:port"`). The `/api/*` routes are
not checked. Additionally served (by the build adapter's `serveStatic`): `/static/*` (island JS) and `/.vite/*` (the
build manifest, harmless).

**One addition for the island:** `POST /actions/like` with `Accept: application/json` returns the API's status and
JSON (`201 {"liked":true,"already_liked":false,…}`, `200` if already liked) instead of the 303, and `401
{"error":"not signed in"}` without a token cookie. Plain form posts (no JS, curl, the load test never uses this route)
behave exactly as in `../hono-jsx-bun`.

## The island (why one, and why the like button)

The SSR variants without a client framework (`../express`, `../hono-jsx-bun`, …) use plain forms for likes; the
hydrating ones (`../remix`, `../tanstack-start`) enhance the like form with JS (submit over fetch/RPC, then refresh the
data) while keeping it a working form. A real HonoX app uses islands for exactly this kind of small interactive piece,
so this variant makes **the like form an island** and keeps everything else (compose, sign-in, links) as plain HTML:

- **Server side** it renders the same `<form method="post" action="/actions/like">…<button class="like">♥ <span>N</span>`
  as `../hono-jsx-bun`, wrapped in HonoX's `<honox-island component-name="/app/islands/like-button.tsx"
  data-serialized-props="{&quot;id&quot;:…,&quot;likes&quot;:…}">`. Without JS it is a normal form.
- **In the browser** `createClient()` imports the island chunk and re-renders each island with `hono/jsx/dom`
  (`useState` for the count). A submit becomes `fetch('/actions/like', {Accept: application/json})`; on `201` the count
  goes up by one in place (no page reload, no refetch), `200` (already liked) leaves it, `401` goes to `/login`.
- **Script only where needed.** HonoX tracks which routes import an island: `/` and `/posts/:id` get
  `<script type="module" async src="/static/client-….js">`; `/login` and the plain 404 page ship no JS. (A missing post
  rendered from the post route still carries the script tag: 636 B vs 563 B.)
- **Client JS:** `static/client-*.js` 27.5 KB (11.1 KB gzip: honox client + `hono/jsx/dom`), `static/like-button-*.js`
  4.9 KB (2.0 KB gzip), loaded once per browser and not by the load test (k6 doesn't execute JS or fetch scripts).

## What differs from hono-jsx-bun, and why

- **Markup:** after removing the `<script>` tag and the `<honox-island …>` wrappers and normalizing the labels
  (`Feed · HonoX`, `<span class="stack">honox</span>`, "HonoX frontend" in the description), `/`, `/posts/1`,
  `/login`, `/posts/999999999`, `/posts/abc` and `/nope` are **byte-identical** to `../hono-jsx-bun`, statuses equal.
- **Page size: feed ~14.6–14.9 KB** (14,571 and 14,879 B uncompressed on the seed data at two points of the smoke
  test; `../hono-jsx-bun` on the same data: 11,640 / 11,949 B), i.e. **+2.93 KB**: 20 island wrappers (~143 B each:
  component name + serialized `{id, likes}` props) and the script tag. Post page 1,222 B (1,015), login 894 B (899).
- **Request path:** the build adapter's entry is a wrapper `Hono` app (`serveStatic` for `/styles.css`, `/static/*`,
  `/.vite/*`, then `all('*')` → the HonoX app's `fetch`), so every request is routed twice. Inside, `createApp()`
  mounts one sub-app per route directory (`/`, `/posts`, `/actions`, `/api/posts`, `/api/posts/:id`), each with the
  renderer, the middleware (deduplicated per request with `WeakSet`s) and an "importing islands" flag middleware, plus
  a 404 wrapper; and it runs every request inside `AsyncLocalStorage` (`contextStorage.run`, used by `<Script>`/
  `<HasIslands>` to read that flag). This is HonoX's standard production setup; nothing is tuned away.
- **Build step:** Vite bundles and minifies the server (`dist/index.js`, 77.7 KB, hono + honox inlined) instead of Bun
  transpiling `src/` on load. Vite runs under Bun in the build stage (`bun --bun run build`). Vite 8 warns that the
  honox client plugin still sets the deprecated `esbuild` option (mapped to `oxc`); the build is otherwise clean.
- **Server start:** Bun auto-serves the bundle's default export (`{ fetch, hostname, port }`) – `Bun.serve` with the
  same defaults as `../hono-jsx-bun` (HTTP/1.1 keep-alive, `idleTimeout` 10 s). `app/server.ts` exits on SIGTERM/SIGINT
  (`docker stop` ~0.4 s). Page headers: `Content-Type: text/html; charset=UTF-8`, `Content-Length`, `Date`; no ETag,
  no compression, no `Cache-Control`. Not streamed, so 404s are real 404s.
- **Memory:** ~52 MB RSS after ~60 feed renders (`../hono-jsx-bun`: ~46 MB after ~10).
- **Unchanged:** API client (uncached `fetch`, keep-alive pool), JWT/cookie/CSRF logic, date format, error handling,
  JSON passthrough behaviour.

## Build and run

```bash
bun install --frozen-lockfile
bun --bun run build            # vite build --mode client && vite build  →  dist/
cd dist && NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 \
  JWT_SECRET=twelve-dollar-challenge bun index.js
```

The working directory must be `dist/` (static files are served relative to it, as the HonoX README notes). Env:
`BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`), `NET_DELAY` (optional `tc netem` delay). `bun run dev`
starts Vite's dev server with HMR (not used by the benchmark).

The Dockerfile has two stages on `oven/bun:1.4.3-slim`: build (`bun install --frozen-lockfile`, `bun --bun run build`)
and runtime (+ `iproute2`, only `dist/` copied, `WORKDIR /app/dist`, `exec bun index.js`). Healthcheck and CMD style
are the same as `../hono-jsx-bun`. Image `perf-check/honox` 180 MB. Run in the sim with `FRONTEND=honox`.
