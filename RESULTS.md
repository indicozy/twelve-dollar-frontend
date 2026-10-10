# Results notes

Raw data: `sim/results/results.tsv` (one row per run, written automatically by `sim/sim.sh`),
`sim/results/runs.log` (human-readable lines), and `sim/results/<run>/` (k6 log, k6 summary JSON, CPU/memory samples).

## Servers (the two-droplet simulation, `sim/docker-compose.yml`)

| Name | Container | Role | Limits | Pinned to |
|---|---|---|---|---|
| **api** droplet | `perf-sim-api-1` | Rust + SQLite feed API (`backend/`), fresh seed DB every run | `CPUS` vCPU (1.0 or 0.4), 2 GB RAM, no swap | logical CPU 2 (physical core 1) |
| **web** droplet | `perf-sim-web-1` | the frontend variant being measured | `CPUS` vCPU, 2 GB RAM, no swap; recreated every run | logical CPU 4 (physical core 2) |
| load generator | `perf-sim-k6-run-*` | k6 2.3.0 | unlimited | logical CPUs 6–19 |

Host: Intel i7-12700K; the servers run on performance cores (about 4.9 GHz). That is much faster than a shared 2.3 GHz
DigitalOcean vCPU, so `CPUS=0.4` is the closer stand-in for the video's $12 droplet. Docker's CPU % is relative to one
full core: at `CPUS=0.4`, about 40% means the box is saturated.

## Variants (`frontends/`)

| Variant | Rendering | Description |
|---|---|---|
| `nextjs` | SSR, streamed (Partial Prerendering) | Next.js 16.4 defaults: a static shell built once, with the feed or post rendered on every request from a fresh API call. No caching. One Node process. |
| `nextjs-cached` | SSR + runtime caching | Same app with `"use cache"`, tag invalidation on writes, ETag/304. Nothing is fetched at build. A post page is stored on its first visit and served from cache afterwards; the feed renders per request from cached data. Breaks the "no caching" rule on purpose. |
| `nextjs-csr` | client-side only | `output: "export"`: static HTML/JS/CSS served by nginx 1.27 (1 worker), which also proxies `/api/*` to the api droplet. The browser fetches JSON and renders it. Sign-in takes a pasted seed token. |
| `sveltekit` | SSR, whole page then send | SvelteKit 3.0 / Svelte 5.57, adapter-node 6: the same pages rendered on every request from a fresh API call, no caching, one Node process. Real 404s, no streaming, ETag on rendered pages, no gzip in Node. |

Load scripts: `bench/ssr-load.js` (SSR variants: each view is one HTML page) and `bench/csr-load.js` (CSR: each view is
the HTML document, revalidated with a 304 on revisit, plus its JSON call; JS/CSS fetched once per virtual user). Same user
loop and the same pass thresholds as the video: p95 < 500 ms, p99 < 1 s, errors < 1%.

## Scores (the video's search: warm-up, 2-minute runs doubling then bisecting, 5-minute confirmation hold)

| Variant | vCPU | Score (users, 5-min hold) | req/s | p95 / p99 | First failure above the score | web CPU under load (% of vCPU) / peak | web memory avg / peak | api CPU under load / peak | api memory avg / peak |
|---|---|---:|---:|---|---|---|---|---|---|
| `nextjs-csr` | 0.4 | **16,000** (cap; real limit higher) | 3,228 | 0 / 2 ms | none (capped at 16,000) | 22% (56%) / 37% | 77 / 78 MiB | 17% (44%) / 22% | 72 / 75 MiB |
| `rust-axum` | 0.4 | **16,000** (cap; real limit higher) | 1,494 | 0 / 2 ms | none (capped at 16,000) | 18% (45%) / 25% | 560 / 563 MiB | 19% (46%) / 22% | 72 / 75 MiB |
| `express-nunjucks` | 0.4 | **9,700** | 891 | 473 / 625 ms | 10,400 (p95 773 ms, p99 950 ms, 0.01% errors) | 40% (100%) / 42% | 384 / 409 MiB | 5% (13%) / 8% | 62 / 65 MiB |
| `express` | 0.4 | **7,900** | 733 | 251 / 373 ms | 8,100 (p95 577 ms, p99 848 ms, 0.01% errors) | 39% (98%) / 42% | 343 / 364 MiB | 5% (11%) / 6% | 59 / 62 MiB |
| `aspnet` | 0.4 | **4,900** | 456 | 80 / 347 ms | 5,000 (p95 1,480 ms, p99 2,058 ms, 0% errors) | 38% (95%) / 42% | 156 / 166 MiB | 6% (14%) / 9% | 54 / 55 MiB |
| `nextjs-smart` | 0.4 | **3,600** | 641 | 158 / 697 ms | 4,300 (p95 482 ms, p99 1,289 ms, 0.01% errors) | 40% (100%) / 42% | 454 / 502 MiB | 4% (10%) / 6% | 129 / 132 MiB |
| `nextjs-fullcache` | 0.4 | **3,500** | 326 | 67 / 386 ms | 3,600 (p95 354 ms, p99 1,138 ms, 0.01% errors) | 32% (79%) / 42% | 418 / 444 MiB | 2% (4%) / 4% | 44 / 46 MiB |
| `solidstart` | 0.4 | **3,300** | 306 | 269 / 531 ms | 3,400 (p95 365 ms, p99 1,072 ms, 0.01% errors) | 40% (100%) / 41% | 315 / 335 MiB | 3% (7%) / 5% | 45 / 49 MiB |
| `spring` | 0.4 | **2,900** | 270 | 60 / 80 ms | 3,100 (p95 3,482 ms, p99 4,280 ms, 0% errors) | 39% (99%) / 41% | 270 / 272 MiB | 5% (13%) / 8% | 45 / 47 MiB |
| `tanstack-start` | 0.4 | **2,700** | 250 | 289 / 976 ms | 2,800 (p95 760 ms, p99 2,082 ms, 0.01% errors) | 40% (100%) / 42% | 317 / 337 MiB | 3% (7%) / 5% | 44 / 47 MiB |
| `flask` | 0.4 | **2,600** | 241 | 279 / 458 ms | 2,700 (p95 575 ms, p99 764 ms, 0% errors) | 34% (84%) / 42% | 116 / 130 MiB | 2% (4%) / 4% | 26 / 28 MiB |
| `sveltekit` | 0.4 | **2,500** | 231 | 487 / 662 ms | 3,600 (p95 3,094 ms, p99 3,871 ms, 0.05% errors) | 39% (99%) / 43% | 738 / 767 MiB | 3% (6%) / 6% | 44 / 46 MiB |
| `remix` | 0.4 | **2,500** | 231 | 287 / 565 ms | 2,600 (p95 753 ms, p99 1,491 ms, 0.01% errors) | 40% (100%) / 42% | 316 / 336 MiB | 3% (7%) / 5% | 44 / 46 MiB |
| `astro` | 0.4 | **2,300** | 213 | 486 / 666 ms | 2,400 (p95 771 ms, p99 1,121 ms, 0.02% errors) | 40% (100%) / 42% | 822 / 859 MiB | 3% (7%) / 5% | 43 / 46 MiB |
| `nuxt` | 0.4 | **1,900** | 175 | 350 / 555 ms | 2,000 (p95 814 ms, p99 1,313 ms, 0.02% errors) | 40% (100%) / 42% | 298 / 322 MiB | 3% (7%) / 5% | 42 / 47 MiB |
| `qwik` | 0.4 | **1,800** | 167 | 325 / 742 ms | 1,900 (p95 817 ms, p99 1,737 ms, 0% errors) | 40% (100%) / 42% | 355 / 376 MiB | 3% (7%) / 5% | 42 / 45 MiB |
| `django` | 0.4 | **1,600** | 147 | 421 / 525 ms | 1,700 (p95 788 ms, p99 973 ms, 0% errors) | 40% (100%) / 42% | 143 / 152 MiB | 2% (5%) / 5% | 36 / 40 MiB |
| `nextjs-cached` | 0.4 | **800** | 73 | 375 / 596 ms | 900 (p95 948 ms, p99 1,247 ms, 0.01% errors) | 39% (99%) / 42% | 494 / 530 MiB | 1% (3%) / 4% | 33 / 35 MiB |
| `angular` | 0.4 | **700** | 64 | 290 / 544 ms | 800 (p95 650 ms, p99 1,356 ms, 0.02% errors) | 40% (99%) / 42% | 368 / 389 MiB | 2% (4%) / 4% | 35 / 37 MiB |
| `laravel` | 0.4 | **600** | 55 | 151 / 375 ms | 800 (p95 665 ms, p99 832 ms, 0% errors) | 39% (97%) / 41% | 83 / 97 MiB | 2% (5%) / 4% | 33 / 34 MiB |
| `nextjs` | 0.4 | **500** | 45 | 417 / 617 ms | 600 (p95 1,176 ms, p99 2,055 ms, 0.06% errors) | 38% (95%) / 43% | 371 / 396 MiB | 2% (5%) / 5% | 34 / 46 MiB |
| `nextjs` | 1.0 | **2,500** | 232 | 138 / 229 ms | 2,750 (p95 461 ms, p99 1,468 ms, 0.01% errors) | 88% (88%) / 98% | 480 / 497 MiB | 2% (2%) / 4% | 41 / 44 MiB |

Search step: 250 users at `CPUS=1.0`, 100 users at `CPUS=0.4`.

`nextjs-csr` note: every search is now capped at 16,000 users (`MAX=16000`): a search that reaches the cap stops climbing
and runs its 5-minute hold there, and its score is marked "cap, real limit not reached". The first capped search went
past the cap before the cap existed: 32,000 users also passed a 2-minute run (6,419 req/s, p95 14 ms, p99 92 ms, 0 errors,
web 26% / 41% peak, api 16% / 35% peak), and a 64,000-user run was stopped part-way (no result recorded). Those two runs
are kept only as context; the client-side score is the 5-minute hold at 16,000 (passed).

## Raw throughput (64 connections, no think time, 15 s, `CPUS=1.0`)

| Target | req/s | p50 | p99 |
|---|---:|---:|---:|
| api `GET /feed` | 39,400 | 1.6 ms | 2.1 ms |
| api `GET /posts/:id` | 177,600 | 0.3 ms | 1.2 ms |
| `nextjs` `GET /` | 214 | 263 ms | 1.01 s |
| `nextjs` `GET /posts/:id` | 291 | 197 ms | 509 ms |

## Spot checks (single requests, not load tests)

- `nextjs-cached`: post page 196 ms on first visit, then 3–10 ms `x-nextjs-cache: HIT`; `If-None-Match` gives `304` with
  0 bytes; after a like, the first request is served stale and the next shows the new count; the feed takes 17–34 ms per
  request from cached data.
- `nextjs-csr`: feed HTML 7.3 KB, post HTML 6.7 KB (vs 46.6 KB server-rendered); HTML 304 on revalidation; build assets
  `immutable`; direct loads and in-app navigation to `/posts/<id>` show the right post; 5-user k6 smoke test: 72/72
  checks, page view (document + data) 3 ms average.

## Caveats

- **Express + Nunjucks, first search partly invalid** (2026-10-10, 15:12-15:17): a headless Chrome started by another
  Claude Code session on this machine (agent-browser, software WebGL) used about 9.5 cores, unpinned, from 15:13:18
  until it was pinned to CPUs 16-19 at about 15:17. The 9,400-user run (failed with p95 986 ms, worse than the clean
  10,500-user run) is marked `INVALID`; the 8,900-user run was stopped before it produced a result. The search was
  stopped and resumed cleanly from the last clean bounds (pass 8,400, fail 10,500) with `LO`/`HI`. Its first log is
  kept as `search-express-nunjucks-cpu0.4.part1-chrome-interference.log`.

- **First `nextjs-csr` search is invalid** (runs 15:01–15:45, marked `INVALID` in results.tsv/runs.log, log kept as
  `search-nextjs-csr-cpu0.4.INVALID-generator-ports.log`). All of its errors were k6 running out of local ports
  (`connect: cannot assign requested address`), not server failures: csr-load.js fetches assets with up to 6
  parallel connections per user, and the closed ones held ports in TIME_WAIT. Both servers were mostly idle (web
  about 13%, api about 8% average at a 40% cap). Fixed by widening the port range and enabling `tcp_tw_reuse` in the
  k6 container only; the servers are untouched. The SSR runs had no such errors: the 5,000-user `nextjs` failures
  were real overload (dial timeouts, connection resets).

- The `nextjs` `CPUS=0.4` passing 5-minute hold (14:15–14:21) overlapped with an unpinned `docker build` of the CSR
  image at about 14:19. That could only have hurt it, so 500 is a conservative score.
- Both `nextjs` searches (`CPUS=1.0` and `0.4`) ran while 9 unrelated, unpinned containers (other projects' Postgres,
  workers, adminer) were up on the same host, so those two scores may include some background noise. They were stopped
  on 2026-10-09 at about 14:30; runs after that have only `perf-sim-*` containers running.
- `sim/results/20261009-142415-nextjs-cpu1.0-50vu-15s` is a 15-second pipeline check, not a measurement.
- A game (Postal 2, native Linux via Steam) ran from 15:58:33 on 2026-10-09, unpinned until about 16:01, then pinned
  with its launcher chain to CPUs 8–15 (away from the servers on 2–5). Only the `nextjs-csr` 2,000-user step overlapped
  the unpinned window, and it passed with a large margin (p99 2 ms, 0 errors, servers at about 5% CPU).
  Relaunched as `postal2-bin` at 16:04:55, unpinned until about 16:06, then pinned again. That window overlapped the
  end of the `nextjs-csr` 4,000-user step (passed: p99 1 ms, 0 errors) and the start of the next step.
- A second game, R.E.P.O. (Windows, via Proton 9.0 Beta: 16 processes, 126 game threads), ran unpinned from 16:09:21
  to about 16:10:30, then was pinned to CPUs 8–15 with its whole Proton/Wine tree. The window overlapped the
  `nextjs-csr` 16,000-user step (started 16:07:18). If that step's verdict is borderline, rerun it.
- `nextjs` and `nextjs-cached` return HTTP 200 (not 404) for a missing post, because the status is sent before the
  streamed part discovers the post doesn't exist. The load tests never request a missing post.
- `nextjs` compresses responses in Node (Next's default); `nextjs-cached`, `nextjs-csr` (nginx defaults) and `sveltekit`
  (adapter-node) don't.
