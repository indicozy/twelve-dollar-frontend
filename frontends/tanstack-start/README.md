# tanstack-start: TanStack Start (React) + TanStack Query, server-rendered, no caching

This variant is the TanStack twin of `../nextjs` and `../sveltekit`. It has the same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page is rendered on every request from a fresh API call, in one Node process (Nitro
`node_server` preset, `node .output/server/index.mjs`).

TanStack Query is a data library, not an SSR framework. So the variant runs on **TanStack Start**, TanStack's SSR
framework (TanStack Router plus server functions plus Vite), with **TanStack Query** as its data layer. The two are
joined by the official integration, `@tanstack/react-router-ssr-query`.

## Versions (pinned)

| Package | Version |
|---|---|
| `@tanstack/react-start` | 1.168.60 |
| `@tanstack/react-router` | 1.170.41 |
| `@tanstack/react-query` | 5.104.1 |
| `@tanstack/react-router-ssr-query` | 1.167.3 |
| `react`, `react-dom` | 19.3.0 |
| `vite` | 8.3.4 (Rolldown) |
| `@vitejs/plugin-react` | 6.1.2 |
| `nitro` | 3.0.260903-beta (`nitro/vite`, the Node hosting route in Start's docs; the only published v3 tag is a beta) |
| `typescript` | 7.0.2 |
| Node | 24 |

## File map

| Piece | File | Notes |
|---|---|---|
| Build config | `vite.config.ts` | `tanstackStart()`, `nitro({ preset: "node_server" })`, `viteReact()` |
| Router factory | `src/router.tsx` | `getRouter()`: a **new QueryClient per call** plus `setupRouterSsrQueryIntegration` |
| API client (server-only, uncached `fetch`) | `src/server/api.server.ts` | same functions as the Next.js variant; `*.server.*` files are blocked from the client bundle by Start's import protection |
| Demo login token, cookie reading | `src/server/session.server.ts` | same HS256 payload as `sveltekit/src/lib/server/session.ts` |
| Server functions | `src/lib/server-fns.ts` | reads: `fetchFeed`, `fetchPost`, `fetchUsername`; writes: `likeAction`, `createPostAction`, `loginAction` |
| Query options | `src/lib/queries.ts` | `["feed"]`, `["post", id]`, `["username"]`; each `queryFn` calls a server function |
| Document, header, signed-in name | `src/routes/__root.tsx` | root loader fetches `["username"]` (from the `token` cookie, per request) |
| Feed `/` | `src/routes/index.tsx` | loader `await queryClient.query(feedQuery)`, component `useSuspenseQuery(feedQuery)` |
| Post `/posts/$id` | `src/routes/posts/$id.tsx` | loader throws `notFound()` for missing or invalid ids, which gives a real 404 |
| Login | `src/routes/login.tsx` | form → `loginAction` (sets an httpOnly `token` cookie, 303 to `/`) |
| Post card, compose, 404 | `src/components/*.tsx` | markup identical to the Next.js `post-card.tsx` / `compose.tsx` / `not-found.tsx` |
| JSON pass-through for the load test | `src/routes/api/posts.ts`, `src/routes/api/posts/$id/like.ts` | Start server routes; forward `Authorization` as-is |
| Generated route tree | `src/routeTree.gen.ts` | written by the router plugin during `vite dev` and `vite build` |

## Per-request QueryClient and dehydration

- Start calls `getRouter()` once per server request, and once in the browser. Each call creates a new
  `QueryClient`, so no query data outlives a request on the server. There is no persister and no shared cache.
- Route loaders call `context.queryClient.query(options)`. This is Query 5.10x's replacement for `ensureQueryData` and
  `fetchQuery`, which are deprecated in the installed types. Loaders run before rendering, so the API is called on the
  server and the HTML already contains the posts.
- `staleTime` is explicitly `0`, which is Query's default, so every `query(...)` call fetches. The router's
  `defaultStaleTime` and `defaultPreloadStaleTime` are also `0`.
- `refetchOnMount: false` and `refetchOnWindowFocus: false` are set so that the route loader is the only thing that
  fetches. With `staleTime: 0` alone, every hydrated query is stale at once. The browser would then refetch the feed
  and the username right after hydration, again after every client navigation (on top of the loader's own fetch), and
  on every tab focus. None of the other variants do that. This is client-side behaviour only and caches nothing.
- **What is serialized into the HTML.** `setupRouterSsrQueryIntegration` dehydrates the request's QueryClient
  into the router's SSR payload. It is one inline `<script>` that the Seroval serializer writes after the markup.
  The script holds each query's `queryKey`, `state.data` and status fields, the route matches, and a small Seroval
  stream shim. The integration uses the shim to stream queries that resolve during render; here none do, because
  the loaders await everything. Loaders return nothing, so the data is serialized once, as query state, and not a
  second time as loader data. On `/` the payload script is about 7 KB of the about 20 KB page. Every post is in the
  page twice: once as HTML and once as JSON for hydration (the same as the Next.js RSC payload and SvelteKit's `data`).
- Query functions call `createServerFn` functions. During SSR these run in-process. After hydration they are
  `GET /_serverFn/<hash>` RPC calls. `BACKEND_URL` and `JWT_SECRET` exist only on the server, and the client bundle
  was grepped for them.

## How it renders

- **Streaming SSR (Start's default, kept).** The response is `Transfer-Encoding: chunked`, written by Start's stream
  renderer. Route loaders are awaited before rendering starts, though. So the status code is final, the page has no
  skeletons or fallbacks, and the body is the complete page plus the dehydration script, flushed as chunks. Nothing is
  prerendered. `vite.config.ts` has no prerender and no `ssr: false`.
- **Status codes.** `/posts/<missing>` and `/posts/abc` → `notFound()` in the loader → **404** with the post route's
  `notFoundComponent`. An unknown path → **404** with the root `notFoundComponent`. `/login` → 200.
- **Headers on pages:** `content-type: text/html; charset=utf-8`, `transfer-encoding: chunked`. There is **no
  ETag, no Cache-Control and no compression**. Nitro's Node server doesn't gzip, even with `Accept-Encoding: gzip`.
  Hashed `/assets/*` files are served by Nitro with `cache-control: public, max-age=31536000, immutable` and an ETag.
  That is framework default static-file behaviour, not set by this app.
- **Link preloading is off** (`defaultPreload: false`), so hovering or seeing links fires no requests. `<Link>`
  renders literally `href="/posts/<id>"`.

## Mutations (likes, new posts, login)

- Each form is `<form method="post" action={serverFn.url}>`, so it **works without JavaScript**. The browser
  posts the form to the server function, and the function answers with a **303**: back to the page it came from (a
  same-origin `Referer`, else `/`), to `/` after login, or to `/login` if there's no `token` cookie. Without JS, an
  API error on compose isn't shown; the page just reloads.
- With JavaScript, `onSubmit` calls the same function over RPC (`useServerFn`), with the token forwarded as
  `Authorization: Bearer <cookie>`. Then it invalidates the affected queries: `["feed"]` and `["post", …]` after a
  like, `["feed"]` after a new post, and `["username"]` after login. Login's redirect becomes a client navigation.
  The handler tells the two cases apart by Start's `x-tsr-serverfn: true` RPC header.
- **Origin check.** Start installs its CSRF middleware for server functions by default. There is no `src/start.ts`,
  so the default is used. It compares `Sec-Fetch-Site`, else `Origin`, else `Referer`, with the **request's own
  origin**. That origin comes from the `Host` header and the plain-http scheme, so form posts work over plain http
  on `localhost:3000` and `127.0.0.1:3000` without configuring an origin. This differs from SvelteKit, where the
  origin is fixed at build time. Requests that carry none of these headers (for example, bare `curl`) get **403**.
  The JSON `/api/*` server routes aren't server functions, so the check doesn't apply to them and the k6 writes go
  through.

## Differences from the Next.js / SvelteKit variants

- **Streaming:** chunked like Next.js, but without Suspense fallbacks or a late status: data is loaded before the
  shell is rendered, as in SvelteKit. Missing posts are a real 404, as in SvelteKit. Next.js streams a 200.
- **Payload duplication:** the posts appear twice, as HTML and as dehydrated query state. The feed page is about 20 KB,
  between SvelteKit (16–19 KB) and Next.js (about 46 KB).
- **ETag:** none on pages (SvelteKit sends one and answers a matching `If-None-Match` with 304).
- **Compression:** none. Next.js gzips by default; SvelteKit's adapter-node doesn't.
- **Origin handling:** checked at runtime against the request's own host, so there is no build-time `ORIGIN`.
- **Gotcha:** the router's SSR payload contains raw NUL bytes inside match ids, so `grep` calls the HTML "binary
  file". Use `grep -a`. k6 and browsers are unaffected, and hydration showed no errors.

## Build / run

```bash
pnpm install && pnpm build          # → .output/ (self-contained: server bundle + public assets, no node_modules)
pnpm check                          # tsc --noEmit
BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge HOST=127.0.0.1 PORT=3000 node .output/server/index.mjs
```

Docker: `Dockerfile` (multi-stage `node:24-bookworm-slim`, runtime image holds only `.output/`; optional `NET_DELAY`
applied with `tc` like the other variants).
