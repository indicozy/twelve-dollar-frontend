# astro-tuned — `../astro` with one formatter per process

Identical to `../astro` (same versions, pages, markup, Dockerfile, no caching) except for one line of app code:
`src/components/PostCard.astro` imports its `Intl.DateTimeFormat` from `src/lib/format.ts` (created once per
process) instead of creating it in the component frontmatter (runs for every rendered card, 20–21 times per page).

Why: constructing an `Intl.DateTimeFormat` is expensive (ICU pattern generation) and allocates native (malloc)
memory that is only released when V8 later garbage-collects the wrapper. Done per card per request, it kept 500+ MB
of native memory alive under load (RSS ~750–850 MiB while the V8 heap was ~200 MiB) and cost CPU: at 2,000 users (184 req/s, 0.4 vCPU) CPU went from 1.98 to ~1.5 ms per request, p95 from 259 to 20–37 ms, and memory from ~790 to ~260 MiB.
Every other JS variant already creates the formatter once at module level (`express`, `nextjs`, `nuxt`, `qwik`,
`angular`, …). Measurements: `../../research/anomalies-js.md`.

The original README follows.

---

The Astro version of `../nextjs` and `../sveltekit`. It has the same pages, markup and CSS (`../SPEC.md`, `../shared/styles.css`).
Every page is rendered on every request from a fresh API call, in one Node process (`node dist/server/entry.mjs`).
It uses plain `.astro` components with no UI framework and no islands, so **the pages ship zero client JS**.

Versions: `astro` 7.3.8, `@astrojs/node` 11.1.7 (`mode: "standalone"`), `@astrojs/check` 0.9.10, TypeScript 6.0.3, Node 24.

| Piece | File | Notes |
|---|---|---|
| Config | `astro.config.mjs` | `output: "server"`, node adapter standalone, `security.checkOrigin` + `allowedDomains` |
| API client (server-only, uncached `fetch`) | `src/lib/server/api.ts` | same functions as the other variants |
| Demo login token + cookie reading | `src/lib/server/session.ts` | same HS256 payload as the SvelteKit variant |
| Mutations | `src/actions/index.ts` | Astro Actions `create`, `like`, `login` (`accept: "form"`) |
| Layout, header with `@username` | `src/layouts/Layout.astro` | reads the `token` cookie per request; imports the stylesheet |
| Post card | `src/components/PostCard.astro` | `<form method="POST" action={actions.like}>` |
| Feed `/` | `src/pages/index.astro` | fetches `GET /feed` in the frontmatter |
| Post `/posts/[id]` | `src/pages/posts/[id].astro` | real **404**: `Astro.rewrite("/404")` |
| Login `/login` | `src/pages/login.astro` | |
| 404 page | `src/pages/404.astro`, `src/components/NotFound.astro` | rendered on demand, status 404 |
| JSON pass-through for the load test | `src/pages/api/posts/index.ts`, `src/pages/api/posts/[id]/like.ts` | forwards `Authorization` |
| Stylesheet | `src/styles/styles.css` | verbatim copy of `../shared/styles.css` |

## How it renders

- **Mutations use Astro Actions submitted as plain HTML forms.** These are Astro's documented way to handle forms,
  and the closest match to SvelteKit form actions and Next.js server actions. The form posts to `?_action=like`. Astro
  runs the action before the page renders. The page's frontmatter reads the result with `Astro.getActionResult()`,
  then sends a `303`: back to the same page on success, or to `/login` if there is no `token` cookie
  (Post/Redirect/Get). If the API rejects a new post (for example, an empty body), the feed is rendered again with the
  API's error and its status, like the other variants. Because the project has `src/actions/`, Astro also exposes the
  `/_actions/*` RPC endpoints. The pages never call them.
- **HTML streaming.** The response uses `Transfer-Encoding: chunked`. The page's frontmatter (the API call) finishes
  before any HTML is written, so nothing reaches the client early, and a missing post is a real 404. There is no
  skeleton or fallback, unlike Next.js.
- **CSS is inlined.** The stylesheet is imported in the layout and bundled the normal way. With the default
  `build.inlineStylesheets: "auto"`, it is under Vite's 4 KB `assetsInlineLimit` (3,789 bytes raw, 3,157 minified), so
  Astro puts it in a `<style>` tag on every page. `dist/client/` stays empty and no CSS request is made. Next.js and
  SvelteKit serve a separate cacheable CSS file instead.
- **Environment.** `BACKEND_URL`, `JWT_SECRET`, `HOST` and `PORT` are read from `process.env` at runtime. The build
  doesn't inline them (`dist/server` still contains `process.env.BACKEND_URL`).

## Differences from the Next.js and SvelteKit variants

- **Payload.** The feed page is about 13 to 15 KB and the post page about 4 KB, including the roughly 3.2 KB inline
  `<style>`. Nothing else is embedded: no hydration data and no scripts. For comparison, SvelteKit's feed page is about
  16 to 19 KB and Next.js's about 46 KB.
- **No ETag, no 304, no `cache-control`.** The response headers are only `content-type: text/html` (no charset in the
  header; the page has `<meta charset="utf-8">`), `Transfer-Encoding: chunked`, and keep-alive.
- **No compression.** The node adapter doesn't gzip or brotli responses, even when `Accept-Encoding` asks for it. Next.js
  compresses by default; SvelteKit doesn't.
- **404.** Missing or invalid post ids, and unknown paths, get the 404 page with status 404. Next.js streams and sends
  200.
- **Origin handling.** `security.checkOrigin` (on by default) returns 403 for a form post (urlencoded, multipart or
  text/plain) whose `Sec-Fetch-Site` is cross-site, or whose `Origin` differs from the request URL's origin. JSON
  requests are not checked, so the load test's writes go through.
  - The catch: the node adapter only trusts the `Host` header when it matches `security.allowedDomains`. Otherwise it
    builds the request URL as `http://localhost:$PORT`. Without `allowedDomains`, form posts to `127.0.0.1:3000` were
    rejected with 403, while posts to `localhost:3000` worked.
  - `astro.config.mjs` therefore trusts `localhost` and `127.0.0.1` over http on any port. The list comes from
    `ALLOWED_HOSTS`, read at build time because it goes into the server manifest. This works like SvelteKit's
    build-time `ORIGIN`.
  - To post forms through another host name, add it to `ALLOWED_HOSTS`, for example
    `docker build --build-arg ALLOWED_HOSTS=localhost,127.0.0.1,10.0.0.5`.
- **Sessions.** The node adapter logs "Enabling sessions with filesystem storage". The app never uses `Astro.session`,
  so nothing is read or written.

## Build and run

```bash
pnpm install && pnpm build                      # ALLOWED_HOSTS=localhost,127.0.0.1 by default
HOST=0.0.0.0 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 node dist/server/entry.mjs
pnpm check                                      # astro check
```

The Docker image copies only `dist/` and `package.json`. The server bundle in `dist/server` is self-contained, so the
image needs no `node_modules`. It runs as `node dist/server/entry.mjs`, applies the optional `NET_DELAY` with
`tc netem`, listens on `0.0.0.0:3000`, and runs the same healthcheck as the other variants.
