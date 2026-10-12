# How many users can a frontend framework serve on a $12 server?

The same small Twitter-style site, built with **33 different stacks**, each
on a box sized like a $12 droplet, against the same fast Rust + SQLite API. The API is never the bottleneck, so the
number you see is the cost of the frontend's server-side rendering.

Follow-up to [“Which Programming Language Can Handle the Most Users on a $12 Server?”](https://www.youtube.com/watch?v=sQXFhh_PiG4)
([repo](https://github.com/arjaythedev/twelve-dollar-server-challenge)), which compared backends. This one compares
frontend frameworks on the same kind of box, with the same user loop and the same pass rule.

**Headline:** plain Next.js held 500 users. Express + Nunjucks on Bun held 24,900, Hono JSX on Bun 24,100, and Rust
passed the 30,000-user cap at about half its CPU. Every server-rendered stack ran out of CPU, not RAM, so the score is
close to the CPU budget divided by the CPU each request burns.

- Full write-up with charts: [`report/analysis.html`](report/analysis.html)
- Slides: [`report/deck.html`](report/deck.html) and [`report/deck.pdf`](report/deck.pdf)
- Scores, run notes and caveats: [`RESULTS.md`](RESULTS.md), [`ANALYSIS-extra.md`](ANALYSIS-extra.md)

## Leaderboard

A score is the most simulated users a stack held for **5 minutes** with p95 < 500 ms, p99 < 1 s and errors < 1%.
One user is about 0.09 requests per second. "CPU/req" is web-server CPU time per request at the score.

| Stack | Folder | Users | req/s | CPU/req (ms) |
|---|---|---:|---:|---:|
| Rust Axum + Askama | `rust-axum` | 30,000 (cap; est. ~50,000) | 2,803 | 0.08 |
| Next.js static (CSR) | `nextjs-csr` | 30,000 (cap; est. ~42,000) | 6,003 | 0.04 |
| Express + Nunjucks on Bun | `express-bun` | 24,900 | 2,318 | 0.17 |
| Hono JSX on Bun | `hono-jsx-bun` | 24,100 | 2,247 | 0.17 |
| Go html/template | `go` | 19,000 | 1,761 | 0.22 |
| HonoX on Bun | `honox` | 16,100 | 1,499 | 0.27 |
| Leptos SSR | `leptos` | 15,500 | 1,441 | 0.26 |
| Next.js + nginx microcache | `nextjs-nginx-cache` | 12,100 | 1,125 | 0.35 |
| Express + Nunjucks | `express-nunjucks` | 9,700 | 891 | 0.45 |
| Phoenix + HEEx | `phoenix` | 8,500 | 787 | 0.51 |
| Hono JSX on Node | `hono-jsx-node` | 8,400 | 775 | 0.52 |
| Express + EJS | `express` | 7,900 | 733 | 0.53 |
| ASP.NET Core Razor | `aspnet` | 4,900 | 456 | 0.83 |
| Next.js smart cache | `nextjs-smart` | 3,600 | 641 | 1.2 |
| Next.js full cache | `nextjs-fullcache` | 3,500 | 326 | 0.98 |
| SolidStart | `solidstart` | 3,300 | 306 | 1.31 |
| Spring Boot + Thymeleaf | `spring` | 2,900 | 270 | 1.44 |
| TanStack Start | `tanstack-start` | 2,700 | 250 | 1.6 |
| Flask + Jinja2 | `flask` | 2,600 | 241 | 1.41 |
| React Router 7 on Bun | `remix-bun` | 2,600 | 241 | 1.54 |
| Remix (React Router 7) | `remix` | 2,500 | 231 | 1.73 |
| SvelteKit | `sveltekit` | 2,500 | 231 | 1.69 |
| Astro | `astro` | 2,300 | 213 | 1.88 |
| Rails + ERB | `rails` | 2,100 | 193 | 2.07 |
| Nuxt | `nuxt` | 1,900 | 175 | 2.29 |
| Qwik City | `qwik` | 1,800 | 167 | 2.4 |
| Django | `django` | 1,600 | 147 | 2.72 |
| Next.js cached | `nextjs-cached` | 800 | 73 | 5.34 |
| Next.js on Bun | `nextjs-bun` | 700 | 65 | 6.0 |
| Angular | `angular` | 700 | 64 | 6.25 |
| Laravel + Blade | `laravel` | 600 | 55 | 7.09 |
| Next.js | `nextjs` | 500 | 45 | 8.44 |
| Next.js on Deno | `nextjs-deno` | 500 | 46 | 8.7 |

Results within about 10% of each other are a tie: one host, one run per user count. The two capped entries were stopped
at 30,000 users while still passing; their estimates come from CPU, memory and API headroom and are not measurements.

### Fixes found by profiling

Nine more runs keep a stack's app and remove one cost a profiler found. They are shown as before and after, not as
separate stacks, the same way the video and report show them.

| Fixed variant | Folder | Users | What changed |
|---|---|---:|---|
| Next.js (tuned) | `nextjs-tuned` | 500 → 800 | cacheComponents off (no second prefetch render), post cards as a client component |
| SvelteKit (fixed) | `sveltekit-tuned` | 2,500 → 5,600 | one date formatter per process instead of one per post card |
| Astro (fixed) | `astro-tuned` | 2,300 → 4,900 | the same date-formatter fix |
| Laravel Octane | `laravel-octane` | 600 → 700 | Octane keeps the framework booted between requests |
| Laravel Octane (tuned) | `laravel-tuned` | 600 → 1,900 | Octane, plus cookie sessions instead of files, no XSRF cookie, includes instead of Blade components, and a reused API connection |
| Spring Boot (AOT cache) | `spring-tuned` | 2,900 → 4,300 | JDK AOT cache, so a fresh container skips minutes of JIT warm-up |
| Django (tuned) | `django-tuned` | 1,600 → 2,000 | precompiled standard library and Jinja2 (the healthcheck kept recompiling them) |
| Flask (precompiled stdlib) | `flask-tuned` | 2,600 → 2,900 | precompiled standard library |
| ASP.NET (tuned) | `aspnet-tuned` | 4,900 → 5,300 | idle thread-pool spinning turned off |

## Repository layout

```
backend/    Rust API (hyper + SQLite) implementing the challenge SPEC; passes its 42/42 test suite
frontends/  SPEC.md (what every stack must render), shared/styles.css, and one folder per stack
bench/      k6 scripts: ssr-load.js (the user loop over HTML pages), csr-load.js, smart-load.js, throughput.js
sim/        the two-droplet simulation in Docker, the max-users search, results and table scripts
report/     build.py turns sim/results into data.json, analysis.html and deck.html
scripts/    setup.sh (seed DB, k6, builds), start-backend.sh, start-nextjs.sh, fresh-db.sh
video/      the Remotion project for the video (scenes, captions, voice-over drafts)
RESULTS.md  server setup, every variant's description, scores and run notes
```

`research/` and `data/` are local only and not in the repo; `scripts/setup.sh` recreates what the benchmark needs.

## Running it

Requirements: Linux, Docker, Rust (stable), Node 24 with pnpm, Python 3, git and curl, and about 10 GB of disk for images and the seed
database. Each stack's own toolchain is inside its Docker image.

```bash
bash scripts/setup.sh                          # clone the challenge, seed the DB, fetch k6, build the API
export CPUS=0.4                                # the $12-droplet stand-in (sim.sh alone defaults to a full core)
FRONTEND=express bash sim/sim.sh up            # build and start the api + web boxes for one stack
FRONTEND=express bash sim/sim.sh run 2000 2m   # one run: fresh DB, fresh web container, k6 user loop
bash sim/step-search.sh express                # find the max users, then confirm with 5-minute holds
python3 sim/scores-table.py                    # scores table from sim/results/results.tsv
python3 report/build.py                        # rebuild report/data.json and the HTML report
bash sim/sim.sh down
```

### The simulated droplets

Two containers stand in for two $12 droplets: `api` (Rust + SQLite) and `web` (the stack under test). Each has its own
physical core, **0.4 of that core** (about 1.96 GHz of an i7-12700K performance core), 2 GB of RAM and no swap. k6 runs
in a third container on the remaining cores, so the load generator never takes CPU from the servers. Every run starts
from a fresh copy of the seed database (50,000 users, 500,000 posts, about 2 million likes) and a new web container.

Knobs (environment variables): `CPUS` (0.4 for every published score; `step-search.sh` defaults to it, `sim.sh` to 1.0), `MEM` (2g), `API_CPU` / `WEB_CPU` (logical CPUs to pin, default 2
and 4), `K6_CPUS` (default 6-19), `NET_DELAY` (one-way netem delay, e.g. `0.25ms`), `FRONTEND`, and for the search
`START`, `LO`, `STEP`, `MAX`. **Change the CPU pinning to match your machine**; the defaults assume a 12700K.

On a different CPU the absolute numbers will move. The ranking should hold. To compare with a real droplet, run the
challenge's own load test straight at the API (`TARGET=api bash sim/sim.sh search`) on both and scale `CPUS`.

### How a score is found

`sim/step-search.sh` runs a 2-minute test, reads which box is the bottleneck, and jumps to where its CPU would reach
95%. It then moves in 10% steps (with a latency fit in `sim/predict.py` to jump further, and binary search when a jump
overshoots) until a pass sits one step below a fail. The score is the highest user count that then passes a 5-minute
hold; a failed hold steps down 10%. Every run is logged in `sim/results/` (k6 log, summary JSON, CPU and memory
samples) and as one row of `sim/results/results.tsv`.

## Backend (Rust + SQLite)

hyper 1 (HTTP/1.1 keep-alive) + rusqlite (bundled SQLite), mimalloc, fat LTO. One single-threaded runtime per core with
its own `SO_REUSEPORT` listener and read connection; one writer thread group-commits likes and posts. On one full core
it serves about 39,400 feeds or 177,600 post lookups a second, far above what any frontend here can consume.

## Contributing

New stacks, fixes to an existing one, and reruns on other hardware are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT, see [LICENSE](LICENSE). The API and load scripts build on the
[twelve-dollar server challenge](https://github.com/arjaythedev/twelve-dollar-server-challenge), also MIT; see
[NOTICE.md](NOTICE.md).
