# sveltekit-tuned — `../sveltekit` with one formatter per process

Identical to `../sveltekit` (same versions, pages, markup, Dockerfile, no caching) except for one line of app code:
`src/lib/PostCard.svelte` creates its `Intl.DateTimeFormat` in a `<script module>` block (runs once per process)
instead of the instance `<script>` (runs for every rendered card, 20–21 times per page).

Why: constructing an `Intl.DateTimeFormat` is expensive (ICU pattern generation) and allocates native (malloc)
memory that is only released when V8 later garbage-collects the wrapper. Done per card per request, it kept 500+ MB
of native memory alive under load (RSS ~750–850 MiB while the V8 heap was ~200 MiB) and cost CPU: at 2,000 users (184 req/s, 0.4 vCPU) CPU went from 1.95 to 1.43 ms per request, p95 from 233 to 28 ms, and memory from ~690 to ~257 MiB.
Every other JS variant already creates the formatter once at module level (`express`, `nextjs`, `nuxt`, `qwik`,
`angular`, …). Measurements: `../../research/anomalies-js.md`.

The original README follows.

---

The SvelteKit twin of `../nextjs`: same pages, markup and CSS (`../SPEC.md`, `../shared/styles.css`), every page
rendered on every request from a fresh API call, one Node process (`@sveltejs/adapter-node`, `node build`).

| Piece | File | Notes |
|---|---|---|
| API client (server-only, uncached `fetch`) | `src/lib/server/api.ts` | same functions as the Next.js variant |
| Demo login token + cookie reading | `src/lib/server/session.ts` | |
| Feed `/` | `src/routes/+page.server.ts`, `+page.svelte` | `load` calls `GET /feed`; actions `create` and `like` |
| Post `/posts/[id]` | `src/routes/posts/[id]/+page.server.ts`, `+page.svelte` | real **404** for missing or invalid ids (the page renders before anything is sent) |
| Signed-in name in the header | `src/routes/+layout.server.ts` | reads the `token` cookie per request, like the Next.js layout |
| Login | `src/routes/login/` | form action signs the demo token |
| JSON pass-through for the load test | `src/routes/api/posts/**/+server.ts` | forwards `Authorization` |

Differences from the Next.js variant worth knowing when comparing:

- **No streaming.** SvelteKit renders the whole page, then sends it, so a page has no skeleton and no
  per-component payload. The feed page is about 16–19 KB, against about 46 KB for Next.js.
- **Hydration.** The page embeds its `load` data, and the browser runs the page's components to take it over.
- **ETag.** SvelteKit sends an ETag for rendered pages and answers a matching `If-None-Match` with 304. The page is
  still rendered first; it is not a cache.
- **No compression in Node** (adapter-node doesn't gzip dynamic responses; Next.js does by default).
- **Origin is set at build time.** adapter-node 6 dropped the runtime `ORIGIN` variable. Without an origin it assumes
  https, and over plain http every form action is then rejected as cross-site (403). `vite.config.ts` reads `ORIGIN` at
  build time (default `http://localhost:3000`, plus its `127.0.0.1` twin). JSON requests, including the load test's
  writes, aren't subject to this check.

```bash
pnpm install && ORIGIN=http://localhost:3000 pnpm build
BACKEND_URL=http://127.0.0.1:4000 PORT=3000 node build
```
