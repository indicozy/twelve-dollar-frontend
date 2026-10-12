# express-bun: Express 5 + Nunjucks on Bun, server-rendered on every request, no caching

The same app as `../express-nunjucks` (same `server.js`, `lib/`, `views/`, `public/`, same lockfile) with one change:
the server runs on **Bun 1.4.3** instead of Node 24. Comparing the two isolates the runtime cost for the fastest JS
variant, the same way `../nextjs-bun` does for Next.js. The only visible difference is the header label
(`express nunjucks · bun`).

| | |
|---|---|
| Versions | Express 5.3.0, Nunjucks 3.2.4, Bun 1.4.3 (`oven/bun:1.4.3-slim`), pnpm 10.8.0 (install only, on Node 24) |
| Install | `pnpm install --prod --frozen-lockfile` from the same `pnpm-lock.yaml` in a Node build stage; `node_modules` is copied into the Bun image, so the dependency versions are exactly those of `../express-nunjucks` (no `bun.lock` re-resolution) |
| Run | `bun server.js`: Express on Bun's `node:http` compatibility layer; API calls use Bun's built-in `fetch` (keep-alive pool) |
| Rendering | as in `../express-nunjucks`: each template compiles to a JS function on first use and is kept (production) |
| Feed page | same bytes as `../express-nunjucks` (about 10.3 KB uncompressed) |

No code changes were needed. Everything else (behaviour, headers, ETag, keep-alive, the Origin check, `/actions/*` and
`/api/*` routes) is described in `../express/README.md`.

```bash
pnpm install --frozen-lockfile
NODE_ENV=production BACKEND_URL=http://127.0.0.1:4000 PORT=3000 bun server.js
```
