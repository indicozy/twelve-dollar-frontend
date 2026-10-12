# hono-jsx-node: Hono 4 + hono/jsx on Node 24, server-rendered on every request, no caching

The runtime twin of `../hono-jsx-bun`: **the same `src/`** (`app.tsx`, `lib/`, `views/` are byte-identical copies; keep
them in sync) running on **Node 24** through **`@hono/node-server`** instead of Bun. Only the entrypoint
(`src/index.tsx`), the build and the Dockerfile differ, and both variants return byte-identical HTML, so comparing
the two isolates the runtime cost (Bun/JavaScriptCore + Bun's native HTTP server vs Node/V8 + `node:http` with the
Web `Request`/`Response` adapter). Everything about the app itself (routes, views, CSRF behaviour, passthroughs,
output shape) is described in `../hono-jsx-bun/README.md`.

| | |
|---|---|
| Versions | hono 4.13.13, @hono/node-server 2.1.4, Node 24 (`node:24-bookworm-slim`, 24.21.0), pnpm 10.8.0; build: typescript 7.0.2, @types/node 24.19.2 (exact pins, `pnpm-lock.yaml` committed) |
| Entrypoint | `src/index.tsx`: `serveStatic` from `@hono/node-server/serve-static`, `serve({ fetch: app.fetch, hostname, port })`, SIGTERM handler |
| Build | `pnpm build` = `tsc`: TSX → ES2024 ESM in `dist/` (`jsx: react-jsx`, `jsxImportSource: hono/jsx`, `module: NodeNext`); relative imports use `.js` specifiers in `src/` so the same files work unchanged on Bun and on Node |
| Run | `node dist/index.js`, `NODE_ENV=production`, one Node process (no cluster) |
| Server | `@hono/node-server` wraps `http.createServer`: each request becomes a (lazily built) Web `Request`, `app.fetch` returns a `Response`, which is written back to the `ServerResponse`. Node defaults kept: `keepAliveTimeout` 5 s (`Keep-Alive: timeout=5`) |
| Page headers | `content-type: text/html; charset=UTF-8`, `content-length`, `Date`, `Connection: keep-alive`, `Keep-Alive: timeout=5`; no ETag |
| Memory | ~116 MB RSS after 50 feed renders (Bun variant: ~60 MB) |

```bash
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 node dist/index.js   # or: pnpm start
```

The Dockerfile has two stages on `node:24-bookworm-slim`: a build stage (`pnpm install --frozen-lockfile`, `pnpm build`)
and a runtime stage (+ `iproute2`, `pnpm install --prod --frozen-lockfile`, `dist/` and `public/`), the optional
`NET_DELAY` with `tc netem`, then `exec node dist/index.js` on `0.0.0.0:3000`; the healthcheck is the same `fetch`
one-liner as `../express`. Image `perf-hono-jsx-node`, 246 MB. Run in the sim with `FRONTEND=hono-jsx-node`.
