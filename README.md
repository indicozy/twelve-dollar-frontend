# perf — SSR frameworks on a $12 server

Follow-up to [“Which Programming Language Can Handle the Most Users on a $12 Server?”](https://www.youtube.com/watch?v=sQXFhh_PiG4)
([repo](https://github.com/arjaythedev/twelve-dollar-server-challenge)). That video compared **backends**; this one compares
**frontend frameworks' server-side rendering** on the same box. The API underneath is a maxed-out Rust + SQLite server, so
the frontend is the only thing being measured.

```
research/   local only, not in this repo: ref-repo/ (the challenge, cloned by scripts/setup.sh) and reference material
backend/    Rust API: the challenge SPEC, passes its 42/42 test suite
frontends/  SPEC.md (what every framework must render), shared/styles.css, nextjs/ (reference impl),
            nextjs-cached/ (same app, runtime caching — breaks the no-caching rule on purpose),
            nextjs-csr/ (client-side only: static export served by nginx, browser fetches JSON),
            sveltekit/ (SvelteKit 3 / Svelte 5, server-rendered, no caching: the Next.js twin)
bench/      ssr-load.js (the video's user loop over HTML pages), csr-load.js (same loop as a browser loads a
            client-rendered app), throughput.js (raw req/s)
scripts/    setup.sh, fresh-db.sh, start-backend.sh, start-nextjs.sh
sim/        two simulated $12 droplets in Docker + the video's max-users search (sim.sh)
RESULTS.md  server names, variant descriptions, scores and caveats (raw rows: sim/results/results.tsv)
```

## Quick start

```bash
bash scripts/setup.sh                     # seed DB, sqlite3/k6 if missing, release builds
bash scripts/start-backend.sh &           # API on :4000 (fresh copy of the seed DB every start)
bash scripts/start-nextjs.sh &            # Next.js on :3000
.tools/k6 run -e VUS=2000 bench/ssr-load.js
.tools/k6 run -e URL=http://127.0.0.1:3000/ bench/throughput.js
bash research/ref-repo/test/run.sh backend   # challenge conformance tests (42 checks)
```

## Two-droplet simulation (`sim/`)

Two containers stand in for two $12 droplets, each with **1 vCPU, 2 GB RAM and no swap**:
`api` (Rust + SQLite) and `web` (the frontend). Each is pinned to its own physical core and has its own
network stack and IP on a private bridge network. k6 runs in a third container on the remaining cores,
so the load generator never takes CPU from the servers.

```bash
bash sim/sim.sh up               # build + start (needs the Docker daemon)
bash sim/sim.sh run 2000 2m      # one run: fresh DB + fresh frontend, k6 ssr-load.js, CPU/mem sampled
bash sim/sim.sh search           # the video's procedure (below)
bash sim/sim.sh throughput /     # raw req/s on one page
TARGET=api bash sim/sim.sh search   # challenge load.js straight at the Rust API (calibration)
bash sim/sim.sh down
```

`search` repeats the video's method with the same pass thresholds (p95 < 500 ms, p99 < 1 s, errors < 1%).
It warms up with 1,000 users for 2 minutes, starts at 2,500 users, doubles until a 2-minute run fails, then
bisects down to 250-user precision. It confirms the result with a 5-minute hold, stepping down 250 users
until a hold passes. Each run writes `sim/results/<run>/{k6.log,summary.json,stats.csv}` and adds one line
to `sim/results/runs.log` (req/s, median/p95/p99, errors, average and peak CPU and memory for each server).

Knobs: `CPUS` (default 1.0), `MEM` (2g), `API_CPU`/`WEB_CPU` (logical CPU to pin, defaults 2 and 4, on
different physical cores), `K6_CPUS` (6-19), `NET_DELAY` (one-way tc netem delay on each server, e.g.
`0.25ms` to model a droplet's private network), `FRONTEND` (a folder in `frontends/`), `START`, `RAMP_UP`.

**Calibration caveat:** one core here is an i7-12700K performance core at about 4.9 GHz. That is much faster
than a shared 2.3 GHz droplet vCPU, which also loses time to noisy neighbours. Absolute user counts will
come out higher than on DigitalOcean, while the ranking between frameworks should hold. To get closer,
lower `CPUS` (for example `CPUS=0.4`). You can tune it by running `TARGET=api` with the challenge
load.js and comparing against a real droplet.

## Backend (Rust + SQLite)

hyper 1 (HTTP/1.1 keep-alive) + rusqlite (bundled SQLite 3.50), mimalloc, fat LTO.

- **Thread-per-core**: one single-threaded tokio runtime per core, each with its own `SO_REUSEPORT`
  listener and its own SQLite read connection. No pool, no locks, no cross-thread handoff on reads.
- **Reads inline**: SQLite is in-process with 1 GB `mmap`; the feed query (20 posts + author + like
  counts via `likes_post_id_idx`) takes microseconds, prepared statements are cached.
- **Group commit**: one writer thread owns the write connection, drains every queued like/post into a
  single `BEGIN IMMEDIATE … COMMIT`, and answers each request only after the commit (WAL,
  `synchronous=NORMAL`, i.e. within the challenge rules).
- Hand-written JSON output, HS256 verification on every request (no token cache).
- `THREADS` env overrides the worker count (use `THREADS=1` to mimic the 1-vCPU droplet).

Why not something faster than SQLite? With an in-process, mmap'd SQLite the API already does ~65k
feed req/s locally — two orders of magnitude above what any SSR layer can consume — and the challenge
rules (and comparability with the video) fix SQLite.

## Raw throughput in the simulation (1 vCPU each, 64 connections, 15 s)

| Target | req/s | p50 | p99 |
|---|---:|---:|---:|
| Rust `GET /feed` | 39,400 | 1.6 ms | 2.1 ms |
| Rust `GET /posts/:id` | 177,600 | 0.3 ms | 1.2 ms |
| Next.js 16 `GET /` (feed page) | 214 | 263 ms | 1.01 s |
| Next.js 16 `GET /posts/:id` | 291 | 197 ms | 509 ms |

## First numbers (unconstrained dev box: 20 threads, k6 on the same machine, 64 connections, 15 s)

| Target | req/s | p50 | p99 |
|---|---:|---:|---:|
| Rust `GET /feed` (JSON) | 64,600 | 0.8 ms | 2.7 ms |
| Rust `GET /posts/:id` (JSON) | 253,800 | 0.1 ms | 1.4 ms |
| Next.js 16 `GET /` (feed page, 48 KB) | 242 | 246 ms | 542 ms |
| Next.js 16 `GET /posts/:id` (14 KB) | 331 | 184 ms | 349 ms |

Next.js is a single Node process, so it uses one core regardless of machine size. Real numbers belong
on the 1 vCPU / 2 GB droplet with k6 on a separate machine (see research/NOTES.md for the method).

## Next steps

Add more frameworks under `frontends/` following `frontends/SPEC.md` (Nuxt, SvelteKit, Remix/React Router,
Astro, SolidStart, Qwik, Angular SSR, TanStack Start, Next on Bun, …), then run the video's search →
5-minute-hold procedure with `bench/ssr-load.js`.
