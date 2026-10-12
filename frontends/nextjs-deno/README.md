# nextjs-deno: Next.js 16 on Deno

The same app and the same production build as `../nextjs` (Node 24 + pnpm, `output: "standalone"`). Only the runtime
changes: the standalone `server.js` runs on **Deno 2.9.7** through Deno's Node compatibility layer, so the benchmark
isolates runtime cost (compare `../nextjs-bun`). The only visible difference is the header label (`next.js · deno`).

| | |
|---|---|
| Versions | Next.js 16.4.0, React 19.3.0, Deno 2.9.7 (`denoland/deno:debian-2.9.7`), build on Node 24 + pnpm 10.8.0 |
| Run | `deno run -A server.js` (all permissions: net, env, read, sys, ...) |
| Rendering | as in `../nextjs` (dynamic SSR per request, Cache Components / PPR shell + streamed content) |

**The one Deno-specific change.** Deno treats `.js` as ESM unless the nearest `package.json` says
`"type": "commonjs"`, so the unmodified standalone output fails with `ReferenceError: require is not defined`. The
standalone `server.js` and the compiled `.next/server` chunks are CommonJS (Node assumes that when `"type"` is missing),
so the Dockerfile adds `"type": "commonjs"` to `.next/standalone/package.json` after the build. That is the same
semantics on Node; no app code or Next.js file is changed. (Alternatives: `--unstable-detect-cjs`, or renaming to
`server.cjs`.)

Checked: `/`, `/posts/1`, `/posts/999999999`, `/login`, the `/api/*` routes and the server actions (sign in, like,
compose) behave as on Node; the HTML matches `../nextjs` apart from per-build hashes and flight-chunk order.
Like `../nextjs`, an unknown post returns the not-found page with status 200 (the status is sent with the streamed
shell before `notFound()` runs); that is Next.js behaviour, not Deno's.
