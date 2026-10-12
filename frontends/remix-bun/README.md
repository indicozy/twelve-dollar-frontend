# remix-bun: React Router 7 framework mode on Bun (Bun.serve), server-rendered, no caching

The same app as `../remix` (same `app/`, same `react-router build`, same package versions) with one change: the
production server. Instead of `react-router-serve` (Express 4 on Node 24), a 40-line `server.ts` runs on **Bun 1.4.3**
and passes every `Bun.serve` Request straight to React Router's Fetch API handler, `createRequestHandler(build)` from
`react-router`. That handler is the runtime-agnostic core that `@react-router/express` (and so `react-router-serve`)
and the Cloudflare/Deno adapters wrap. React Router has no Bun adapter and no Bun template, and `Bun.serve` already speaks
`Request`/`Response`, so this is the idiomatic Bun setup. Comparing with `../remix` shows what the runtime and server
cost for the React SSR framework, the same way `../nextjs-bun` does for Next.js and `../express-bun` for Express.

The only visible difference in the HTML is the header label (`remix · bun`) and the hashed name of the root JS chunk
that contains it (see the note on the ScrollRestoration script below).

| | |
|---|---|
| Versions | react-router / @react-router/{node,dev} **7.18.4**, react / react-dom 19.3.0, vite 8.3.4, typescript 6.0.3, isbot 5.2.2 (all as in `../remix`); **Bun 1.4.3** (`oven/bun:1.4.3-slim`); @types/bun 1.4.2 (dev only); pnpm 10.8.0 (install and build only, on Node 24) |
| Removed | `@react-router/serve` (and with it Express, compression, morgan) |
| Build | `pnpm install --frozen-lockfile && pnpm build` in a Node 24 stage, exactly as `../remix`; prod `node_modules` from `pnpm install --prod`, copied into the Bun image (no `bun.lock` re-resolution) |
| Run | `bun server.ts` (Bun runs the TypeScript directly), one process |
| Rendering | unchanged: the framework's default `entry.server` (no custom one), i.e. `renderToPipeableStream` from `react-dom/server`, which on Bun resolves to `server.bun.js` (it exports `renderToPipeableStream` too); the Node stream goes through Bun's `node:stream` and `@react-router/node`'s `createReadableStreamFromReadable` |
| Feed page | same as `../remix` (about 22 KB uncompressed, including the turbo-stream hydration payload) |

| Piece | File | Notes |
|---|---|---|
| Server | `server.ts` | `createRequestHandler(build, NODE_ENV)`; `Bun.serve({ hostname: HOST, port: PORT, routes, fetch })`; SIGTERM handler |
| Client files | `server.ts` | `build/client/**` is read once at startup into `Bun.serve` static `routes` (in-memory Responses): `/assets/*` with `Cache-Control: public, max-age=31536000, immutable` (as `react-router-serve`), `/favicon.ico` without |
| Everything else | `app/`, `react-router.config.ts`, `vite.config.ts` | identical to `../remix` except the header label in `app/root.tsx`; see `../remix/README.md` |

## What differs from `../remix` (react-router-serve)

- **No gzip.** `react-router-serve` mounts `compression()`; `Bun.serve` does not compress dynamic responses, and
  React Router's docs leave compression to the server or proxy. The load test (k6) sends no `Accept-Encoding`, so
  `../remix` doesn't compress for it either. Browsers get gzip from `../remix` and plain HTML from this variant.
- **No request log.** `react-router-serve` writes a `morgan("tiny")` line per request; this server logs nothing per
  request (only the startup line, and React Router's own error logs, e.g. `No route matches URL` for unknown paths).
- **No per-request file-system lookups.** `react-router-serve` puts three `express.static` middlewares before the
  React Router handler, so every page request first does `stat()`s; here client files are matched in memory by
  Bun's router before `fetch` runs.
- **Content-Length instead of chunked.** The render is the same streaming `renderToPipeableStream`, but Bun sends
  short bodies that have finished by the time the headers go out with a `Content-Length`. `../remix` always sends
  `Transfer-Encoding: chunked`. Status codes are the same (404s are 404).
- **Header casing and defaults:** Bun's (`Content-Type: text/html`, no `Keep-Alive: timeout=5` header; Bun's idle
  timeout is 10 s).
- **The inline ScrollRestoration script is formatted differently.** React Router renders it from a function's
  source text (`fn.toString()`). Node 24 loads `react-router`'s `dist/development/index.mjs` (the `module-sync`
  condition), and Bun loads the CJS `index.js` of the same package, whose transpiled copy of that function is
  formatted differently. The code does the same thing; the page bytes differ by a few characters. Everything else in
  the markup (`data-post-id`, `href="/posts/N"`, the turbo-stream, the manifest) is identical.
- Same Origin (CSRF) check on form posts, same 404 page, same JSON passthrough routes, same login/like/compose
  behaviour (all of that is inside the React Router request handler, not the server).

## Gotchas

- `NODE_ENV=production` is set in the image (`ENV`) and drives both React's production build and the handler's
  mode. Without it, React loads its development build.
- `@react-router/node` must stay a dependency even though nothing here imports it directly: `react-router build`
  picks the default `entry.server.node.tsx` only when it is installed, and that entry imports
  `createReadableStreamFromReadable` from it.
- The default `entry.server` is kept on purpose (same app code as `../remix`). A custom `app/entry.server.tsx`
  using `renderToReadableStream` (the Web-stream API, as in React Router's Cloudflare template) skips the
  `node:stream` bridge. In a side test (not part of this variant) it used about 3.6 CPU ms/request against 6.0 for
  this variant, in interleaved runs at 350 VUs. That would be a separate "tuned" variant.
- `react-router typegen` on Vite 8 prints `The envFile option is deprecated` (from `@react-router/dev`, as in `../remix`).

## Build / run

```bash
pnpm install && pnpm build        # react-router build -> build/client + build/server (Node)
pnpm typecheck                    # react-router typegen && tsc
NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 \
  JWT_SECRET=twelve-dollar-challenge bun server.ts
```

Docker: the same build and prod-deps stages as `../remix/Dockerfile`, then `oven/bun:1.4.3-slim` with
`package.json`, `server.ts`, `build/` and production `node_modules`, plus iproute2 for the optional `NET_DELAY`
(tc netem).
