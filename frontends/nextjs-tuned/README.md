# nextjs-tuned: Next.js 16 App Router (React Server Components), tuned after profiling, no caching

`../nextjs` (same routes, Server Components, Server Actions for sign-in / like / compose, `/api/*` route handlers,
standalone server, one Node process) with the changes a team would make after profiling its CPU per request.
Still **no page or data caching**: every page request renders fresh HTML from a fresh, uncached API call
(`fetch(..., { cache: "no-store" })`). The other Next.js variants cover caching (`nextjs-cached`, `-smart`,
`-fullcache`, `-nginx-cache`), other runtimes (`nextjs-bun`, `nextjs-deno`) and CSR (`nextjs-csr`); this one is
"optimise Next.js itself". (A Pages Router port, `../nextjs-pages`, was built but is not part of the benchmark.)
Profile, per-change measurements and method: `research/anomalies-nextjs.md`.

| | |
|---|---|
| Versions | Same as `../nextjs` (`package.json` / `pnpm-lock.yaml` unchanged apart from the package name): **Next.js 16.4.0** (Turbopack build), **React / react-dom 19.3.0**, TypeScript 5.9.3, pnpm 10.8.0 (corepack). Node **24.21.0**: `node:24-bookworm-slim`, now pinned by digest (`sha256:d6aa754f…`, the image `../nextjs` resolved to when checked) |
| Server | `node server.js` from `output: "standalone"`, one process (unchanged) |
| Node flags | `NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=16"` (Dockerfile `ENV`) |
| Feed page | 25.2 KB (`../nextjs`: 45.2 KB), of which 8.7 KB is the inlined RSC payload (was 28.4 KB). Post page 8.9 KB (14.2 KB) |

## Changes from `../nextjs`

| File | Change | Why |
|---|---|---|
| `next.config.ts` | `cacheComponents: true` and `partialPrefetching: true` removed (both off) | Every page here depends on request-time data (the token cookie, a `no-store` API call), so Partial Prerendering's static shell is just the header and the skeletons. With `cacheComponents` on, Next 16.4 also turns on Cached Navigations, and each request then runs a *staged* RSC render (replayed into two streams to count the static-stage bytes) and, with Partial Prefetching, a second "runtime prefetch" RSC render whose output is embedded in the page. Off, a request is one ordinary dynamic render (the Next 15 model). Streaming, the `<Suspense>` boundaries and their skeleton fallbacks are unchanged. |
| `app/post-card.tsx` | `"use client"` added: `PostCard` is a Client Component | As a Server Component, each post reached the browser twice: as HTML and as its rendered element tree (`article > header > span…`) in the RSC (Flight) payload inlined into the page. As a Client Component, the RSC payload carries only the post's data as props (`{id, body, created_at, author, like_count}`), and React DOM renders the same HTML from it during SSR. The feed's inlined payload drops from 23.0 to 8.7 KB. The like form still posts to the `likeAction` Server Action (a Client Component can import Server Actions). Cost: the card's code (`next/link`, the date formatter) ships to the browser and the 20 cards hydrate. |
| `Dockerfile` | `NODE_OPTIONS="--max-old-space-size=1536 --max-semi-space-size=16"`; base image pinned by digest | V8 sizes the heap from the host's 31 GB (4 GB heap limit, 2 × 64 MB young-generation semi-spaces), not from the 2 GB container limit. The old-space cap keeps V8 below the container limit (standard advice for Node in containers); the 16 MB semi-spaces cut memory under load by ~80 MB. Neither changed CPU per request measurably. |

Markup: same elements, classes and text as `../nextjs` (diffed `/` and `/posts/:id` with scripts removed). What differs
is unavoidable from the config change: the `<!--&-->` Partial-Prerendering resume markers are gone, the
"Sign in"/`@name` header link is rendered in place instead of being streamed into a `<template>` slot (it is in the same
first chunk anyway), the Suspense boundary ids shift (`B:1` → `B:0`), and the Server Action ids are different hashes
(they change with every build).

Side effect: a no-JavaScript compose-form post that the API rejects ("body is required") now shows the error. In
`../nextjs` the form is part of the prerendered static shell, so the re-rendered page after a non-JS action post
showed the prerendered "max 500 chars" instead.

## Measured effect

CPU ms per request = container cgroup CPU / k6 requests; instructions from `perf stat` on the container's cgroup.
`bench/ssr-load.js` at 300 users (≈ 24.5 req/s) for 60 s after a 20 s ramp, 0.4 vCPU, interleaved runs, private API
container. Both numbers include a constant ~1.2–1.6 ms per request at this load for the Docker healthcheck (a fresh
`node -e fetch(...)` every 2 s, plus the page it renders); see the anomalies file.

| Change (alone, on top of `../nextjs`) | Instructions / req | CPU ms / req | Memory | Kept |
|---|---:|---:|---:|---|
| `cacheComponents` (+ `partialPrefetching`) off | **−25 to −29%** (3 rounds) | −12 to −18% | ≈ | yes |
| …or keep it on, `experimental.cachedNavigations: false` | −20% | −14% | | (alternative) |
| …or keep it on, `partialPrefetching: false` | −7% | −6% | | (alternative) |
| `PostCard` as a Client Component (alone) | −23% | noise (+9%, a noisy round) | | |
| …on top of `cacheComponents` off | **−18%** | −4% | −20 MB | yes |
| `--max-semi-space-size=16` | −5% (noise level) | noise | **−80 to −90 MB** | yes |
| `--max-old-space-size=1536` | ≈ | ≈ | −50 to −100 MB | yes |
| `compress: false` | ≈ (−1%) | ≈ | | no (see below) |
| `<a>` instead of `next/link` (`prefetch={false}`) in the card | ≈ (+1%) | ≈ | | no |
| webpack build instead of Turbopack | ≈ (−2%) | ≈ | | no |
| No `<Suspense>` (blocking render, real 404 status) | ≈ | ≈ | | no (markup/UX change) |

| Final, 3 interleaved runs each (300 users), 1 run (400 users) | Instructions / req | CPU ms / req | p95 | Memory after run |
|---|---:|---:|---:|---:|
| `../nextjs`, 300 users | 32.9 M (31.4–34.3) | 10.84 (10.78–10.97) | 161–198 ms | 137–378 MiB |
| `nextjs-tuned`, 300 users | **22.2 M** (21.9–22.4), −33% | **9.10** (9.00–9.23), −16% | 59–71 ms | 167–179 MiB |
| `../nextjs`, 400 users | 29.6 M | 8.90 | 269 ms | 351 MiB |
| `nextjs-tuned`, 400 users | 19.8 M, −33% | 7.56, −15% | 76 ms | 191 MiB |

Instructions fall about twice as much as CPU time: the work removed (RSC serialisation, staged-render bookkeeping)
is straight-line JavaScript, while what remains includes the low-IPC parts (GC, sockets, the healthcheck's process
start). CPU time on these runs was also noisier than instructions (the host had an unrelated busy process allowed on
the same cores). Absolute ms here are higher than the sim's ~8.4 ms for `nextjs` for the same reason.

Not changed, and why:

- **`compress: false`.** Next compresses responses in Node by default. k6 sends no `Accept-Encoding`, so nothing is
  compressed in the load test and the setting changes nothing measurable (the middleware's per-request check is
  cheap). In a real deployment behind a proxy or CDN that compresses, `compress: false` is the right setting and saves
  the gzip CPU for browsers; with no proxy (as in the sim) turning it off would send browsers 25 KB uncompressed
  pages, so it stays at the default.
- Keep-alive to the API: Node's `fetch` (undici) already pools keep-alive connections (5–6 sockets open under load,
  a handful closed per minute when idle), so a custom agent has nothing to add.
- `output: "standalone"`, `NODE_ENV=production`, React production builds: already the case in `../nextjs`.
- Middleware: there is none; the layout's only per-request work is reading the `token` cookie.

## Environment, build and run

Same as `../nextjs`: `BACKEND_URL`, `JWT_SECRET`, `HOSTNAME`/`PORT` (0.0.0.0:3000), `NET_DELAY`; HEALTHCHECK and CMD
line unchanged.

```bash
docker build -t perf-nextjs-tuned .
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:4000 perf-nextjs-tuned
# in sim/: FRONTEND=nextjs-tuned ./sim.sh ...
```
