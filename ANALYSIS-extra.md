# Extra analysis

Generated from `report/data.json` (20261012-0437). All runs at 0.4 vCPU / 2 GB per server, same load script and pass rules as the main results. Numbers for stacks that hit the 30,000-user cap are lower bounds.

## 1. Cost per million page views

A $12/month web server running flat out at its score, 24/7. Every simulated user views 2 pages per ~20.5 s loop (feed, then a post; the like/new-post requests aren't counted), so page views per second = users × 0.0976. That × 30 days = page views per month; cost = $12 ÷ millions of page views. This uses users, not raw req/s, so stacks measured with a different load script (CSR, smart cache) compare fairly. Real traffic isn't flat, so treat it as the floor: what a page view costs when the box is fully used. The API box is the same for every stack and not included.

| Stack | Users held | Page views / month | $ per million page views | Servers for 10,000 users |
|---|---:|---:|---:|---:|
| Rust Axum + Askama | 30,000+ | 7,589 M | $0.0016 (or less) | 1 (or fewer) |
| Next.js static (CSR) | 30,000+ | 7,589 M | $0.0016 (or less) | 1 (or fewer) |
| Express + Nunjucks on Bun | 24,900 | 6,299 M | $0.0019 | 1 |
| Hono JSX on Bun | 24,100 | 6,097 M | $0.0020 | 1 |
| Go html/template | 19,000 | 4,807 M | $0.0025 | 1 |
| HonoX on Bun | 16,100 | 4,073 M | $0.0029 | 1 |
| Leptos SSR | 15,500 | 3,921 M | $0.0031 | 1 |
| Next.js + nginx microcache | 12,100 | 3,061 M | $0.0039 | 1 |
| Express + Nunjucks | 9,700 | 2,454 M | $0.0049 | 2 |
| Phoenix + HEEx | 8,500 | 2,150 M | $0.0056 | 2 |
| Hono JSX on Node | 8,400 | 2,125 M | $0.0056 | 2 |
| Express + EJS | 7,900 | 1,999 M | $0.0060 | 2 |
| SvelteKit (fixed) | 5,600 | 1,417 M | $0.0085 | 2 |
| ASP.NET (tuned) | 5,300 | 1,341 M | $0.0089 | 2 |
| ASP.NET Core Razor | 4,900 | 1,240 M | $0.0097 | 3 |
| Astro (fixed) | 4,900 | 1,240 M | $0.0097 | 3 |
| Spring Boot (AOT cache) | 4,300 | 1,088 M | $0.0110 | 3 |
| Next.js smart cache | 3,600 | 911 M | $0.0132 | 3 |
| Next.js full cache | 3,500 | 885 M | $0.0136 | 3 |
| SolidStart | 3,300 | 835 M | $0.0144 | 4 |
| Spring Boot + Thymeleaf | 2,900 | 734 M | $0.0164 | 4 |
| Flask (precompiled stdlib) | 2,900 | 734 M | $0.0164 | 4 |
| TanStack Start | 2,700 | 683 M | $0.0176 | 4 |
| Flask + Jinja2 | 2,600 | 658 M | $0.0182 | 4 |
| React Router 7 on Bun | 2,600 | 658 M | $0.0182 | 4 |
| Remix (React Router 7) | 2,500 | 632 M | $0.0190 | 4 |
| SvelteKit | 2,500 | 632 M | $0.0190 | 4 |
| Astro | 2,300 | 582 M | $0.0206 | 5 |
| Rails + ERB | 2,100 | 531 M | $0.0226 | 5 |
| Django (tuned) | 2,000 | 506 M | $0.0237 | 5 |
| Nuxt | 1,900 | 481 M | $0.0250 | 6 |
| Laravel Octane (tuned) | 1,900 | 481 M | $0.0250 | 6 |
| Qwik City | 1,800 | 455 M | $0.0264 | 6 |
| Django | 1,600 | 405 M | $0.0296 | 7 |
| Next.js (tuned) | 800 | 202 M | $0.0593 | 13 |
| Next.js cached | 800 | 202 M | $0.0593 | 13 |
| Next.js on Bun | 700 | 177 M | $0.0678 | 15 |
| Angular | 700 | 177 M | $0.0678 | 15 |
| Laravel Octane | 700 | 177 M | $0.0678 | 15 |
| Laravel + Blade | 600 | 152 M | $0.0791 | 17 |
| Next.js | 500 | 126 M | $0.0949 | 20 |
| Next.js on Deno | 500 | 126 M | $0.0949 | 20 |

## 2. Latency at the same load (400 users for everyone)

Every stack at 400 users (below the weakest stack's limit), one 3-minute run after a 60 s ramp-up, fresh database and container. This is what a visitor feels when the server is *not* overloaded.

**Read the CPU column with care.** At 400 users it is mostly *not* rendering cost. Docker runs each stack's healthcheck inside its 0.4-vCPU quota every 2 s: about 8% of the vCPU for Node/Bun/Deno `fetch` checks, about 3% for curl/wget, 7-21% for Python. That is 44-66% of all instructions a Node web container executes at 400 users. On top of that, a mostly idle core runs at a low clock (1.8-3.6 GHz against 4.1-4.6 GHz when busy) with fewer instructions per cycle, so the same work costs 1.5-2.5x more CPU time, and the sim samples `docker stats` only ~25% of the time, so a single run is uncertain by about ±5 points. Example: SvelteKit's formatter fix cuts instructions per request by 51% at 400 users (measured in isolation), yet both versions read 26% here. Use the latency columns from this table, and CPU per request at each stack's limit (section 3, main results) for efficiency. Details: `research/anomalies-sveltekit-lowload.md`.

| Stack | median | p95 | p99 | errors | web CPU incl. healthcheck (% of 0.4 vCPU, ±5) | memory |
|---|---:|---:|---:|---:|---:|---:|
| Next.js static (CSR) | 0 ms | 0 ms | 0 ms | 0.0% | 4% | 15 MiB |
| Rust Axum + Askama | 0 ms | 0 ms | 0 ms | 0.0% | 3% | 18 MiB |
| Phoenix + HEEx | 0 ms | 1 ms | 1 ms | 0.0% | 10% | 205 MiB |
| Go html/template | 1 ms | 2 ms | 3 ms | 0.0% | 14% | 23 MiB |
| Hono JSX on Bun | 1 ms | 2 ms | 4 ms | 0.0% | 13% | 18 MiB |
| Leptos SSR | 1 ms | 2 ms | 3 ms | 0.0% | 15% | 16 MiB |
| Express + Nunjucks on Bun | 1 ms | 3 ms | 5 ms | 0.0% | 17% | 39 MiB |
| Remix (React Router 7) | 1 ms | 3 ms | 10 ms | 0.0% | 23% | 252 MiB |
| SolidStart | 2 ms | 3 ms | 14 ms | 0.0% | 21% | 220 MiB |
| Qwik City | 1 ms | 4 ms | 16 ms | 0.0% | 27% | 244 MiB |
| Rails + ERB | 1 ms | 4 ms | 7 ms | 0.0% | 21% | 94 MiB |
| Spring Boot + Thymeleaf | 1 ms | 4 ms | 22 ms | 0.0% | 20% | 182 MiB |
| Spring Boot (AOT cache) | 1 ms | 4 ms | 15 ms | 0.0% | 16% | 178 MiB |
| SvelteKit | 1 ms | 4 ms | 20 ms | 0.0% | 26% | 522 MiB |
| SvelteKit (fixed) | 1 ms | 4 ms | 22 ms | 0.0% | 26% | 205 MiB |
| ASP.NET (tuned) | 2 ms | 4 ms | 36 ms | 0.0% | 20% | 79 MiB |
| Express + Nunjucks | 2 ms | 4 ms | 34 ms | 0.0% | 28% | 199 MiB |
| ASP.NET Core Razor | 2 ms | 5 ms | 42 ms | 0.0% | 20% | 77 MiB |
| Express + EJS | 2 ms | 5 ms | 33 ms | 0.0% | 36% | 181 MiB |
| Hono JSX on Node | 2 ms | 5 ms | 37 ms | 0.02% | 30% | 176 MiB |
| Next.js smart cache | 0 ms | 6 ms | 29 ms | 0.0% | 38% | 217 MiB |
| Next.js full cache | 1 ms | 6 ms | 29 ms | 0.0% | 32% | 203 MiB |
| Astro (fixed) | 3 ms | 7 ms | 49 ms | 0.0% | 38% | 226 MiB |
| Flask (precompiled stdlib) | 5 ms | 10 ms | 39 ms | 0.0% | 51% | 96 MiB |
| TanStack Start | 4 ms | 12 ms | 50 ms | 0.0% | 50% | 234 MiB |
| Nuxt | 3 ms | 14 ms | 47 ms | 0.0% | 41% | 250 MiB |
| Laravel Octane (tuned) | 8 ms | 14 ms | 21 ms | 0.0% | 64% | 112 MiB |
| Astro | 5 ms | 15 ms | 68 ms | 0.02% | 56% | 612 MiB |
| Django (tuned) | 6 ms | 16 ms | 52 ms | 0.0% | 61% | 121 MiB |
| Next.js + nginx microcache | 0 ms | 20 ms | 56 ms | 0.03% | 36% | 216 MiB |
| Laravel Octane | 9 ms | 23 ms | 47 ms | 0.0% | 70% | 110 MiB |
| Laravel + Blade | 11 ms | 33 ms | 58 ms | 0.0% | 80% | 73 MiB |
| Next.js cached | 5 ms | 34 ms | 88 ms | 0.01% | 49% | 376 MiB |
| Next.js on Bun | 14 ms | 48 ms | 154 ms | 0.0% | 81% | 171 MiB |
| Flask + Jinja2 | 5 ms | 53 ms | 70 ms | 0.0% | 58% | 110 MiB |
| Django | 7 ms | 59 ms | 74 ms | 0.0% | 72% | 137 MiB |
| Next.js on Deno | 13 ms | 65 ms | 117 ms | 0.0% | 70% | 145 MiB |
| Angular | 8 ms | 73 ms | 153 ms | 0.02% | 69% | 341 MiB |
| Next.js | 21 ms | 202 ms | 323 ms | 0.02% | 91% | 353 MiB |

## 3. Does a heavier page cost more CPU?

Feed page size (uncompressed HTML, measured once per stack) against CPU time per request at the score.

| Stack | feed page | CPU per request | group |
|---|---:|---:|---|
| Go html/template | 10.5 KB | 0.22 ms | template |
| Express + EJS | 10.5 KB | 0.53 ms | template |
| Spring Boot (AOT cache) | 10.5 KB | 0.97 ms | template |
| Spring Boot + Thymeleaf | 10.5 KB | 1.44 ms | template |
| Flask (precompiled stdlib) | 10.5 KB | 1.5 ms | template |
| Flask + Jinja2 | 10.5 KB | 1.41 ms | template |
| Hono JSX on Bun | 11.4 KB | 0.17 ms | template |
| Hono JSX on Node | 11.4 KB | 0.52 ms | template |
| Express + Nunjucks on Bun | 12.2 KB | 0.17 ms | template |
| Express + Nunjucks | 12.2 KB | 0.45 ms | template |
| Laravel Octane (tuned) | 12.7 KB | 2.22 ms | template |
| Laravel Octane | 12.7 KB | 6.0 ms | template |
| Laravel + Blade | 12.7 KB | 7.09 ms | template |
| Phoenix + HEEx | 13.1 KB | 0.51 ms | template |
| Rails + ERB | 14.0 KB | 2.07 ms | template |
| Django (tuned) | 14.0 KB | 2.17 ms | template |
| Django | 14.0 KB | 2.72 ms | template |
| Astro (fixed) | 14.3 KB | 0.88 ms | template |
| Astro | 14.3 KB | 1.88 ms | template |
| HonoX on Bun | 14.6 KB | 0.27 ms | hydrate |
| Nuxt | 15.4 KB | 2.29 ms | hydrate |
| Leptos SSR | 15.7 KB | 0.26 ms | hydrate |
| ASP.NET (tuned) | 16.4 KB | 0.75 ms | template |
| ASP.NET Core Razor | 16.4 KB | 0.83 ms | template |
| SvelteKit (fixed) | 17.0 KB | 0.78 ms | hydrate |
| SvelteKit | 17.0 KB | 1.69 ms | hydrate |
| SolidStart | 18.9 KB | 1.31 ms | hydrate |
| React Router 7 on Bun | 18.9 KB | 1.54 ms | hydrate |
| Remix (React Router 7) | 18.9 KB | 1.73 ms | hydrate |
| Angular | 19.4 KB | 6.25 ms | hydrate |
| TanStack Start | 20.4 KB | 1.6 ms | hydrate |
| Next.js (tuned) | 25.2 KB | 4.86 ms | hydrate |
| Qwik City | 36.5 KB | 2.4 ms | hydrate |
| Next.js smart cache | 39.4 KB | 1.2 ms | hydrate |
| Next.js full cache | 39.4 KB | 0.98 ms | hydrate |
| Next.js cached | 44.7 KB | 5.34 ms | hydrate |
| Next.js + nginx microcache | 46.6 KB | 0.35 ms | hydrate |
| Next.js on Bun | 46.6 KB | 6.0 ms | hydrate |
| Next.js | 46.6 KB | 8.44 ms | hydrate |
| Next.js on Deno | 46.6 KB | 8.7 ms | hydrate |

Across 40 stacks (capped ones and the static build left out): Pearson r = 0.50, Spearman ρ = 0.41.
Among pages of 20 KB or less the CPU cost still ranges from 0.17 ms (Express + Nunjucks on Bun) to 7.09 ms (Laravel + Blade), so page size alone doesn't explain the cost: how the page is produced does. The Next.js variants are both the heaviest pages and the most expensive renders, which drives most of the correlation.

## 4. Memory

Peak memory of the web container during its 5-minute hold at the score. No stack came near the 2 GB limit, so memory never decided a score.

| Stack | peak memory | users held |
|---|---:|---:|
| Phoenix + HEEx | 1532 MiB | 8,500 |
| Rust Axum + Askama | 1053 MiB | 30,000+ |
| Astro | 859 MiB | 2,300 |
| Go html/template | 809 MiB | 19,000 |
| SvelteKit | 767 MiB | 2,500 |
| Spring Boot (AOT cache) | 672 MiB | 4,300 |
| Next.js cached | 530 MiB | 800 |
| Leptos SSR | 519 MiB | 15,500 |
| Next.js smart cache | 502 MiB | 3,600 |
| Next.js + nginx microcache | 470 MiB | 12,100 |
| Next.js full cache | 444 MiB | 3,500 |
| Express + Nunjucks | 409 MiB | 9,700 |
| Next.js | 396 MiB | 500 |
| Angular | 389 MiB | 700 |
| Hono JSX on Node | 382 MiB | 8,400 |
| Qwik City | 376 MiB | 1,800 |
| Express + EJS | 364 MiB | 7,900 |
| SvelteKit (fixed) | 364 MiB | 5,600 |
| Astro (fixed) | 355 MiB | 4,900 |
| TanStack Start | 337 MiB | 2,700 |
| Remix (React Router 7) | 336 MiB | 2,500 |
| SolidStart | 335 MiB | 3,300 |
| Express + Nunjucks on Bun | 327 MiB | 24,900 |
| Nuxt | 322 MiB | 1,900 |
| Next.js on Bun | 275 MiB | 700 |
| Spring Boot + Thymeleaf | 272 MiB | 2,900 |
| ASP.NET (tuned) | 241 MiB | 5,300 |
| Next.js (tuned) | 233 MiB | 800 |
| Laravel Octane (tuned) | 180 MiB | 1,900 |
| ASP.NET Core Razor | 166 MiB | 4,900 |
| Next.js on Deno | 162 MiB | 500 |
| Laravel Octane | 153 MiB | 700 |
| Django | 152 MiB | 1,600 |
| Rails + ERB | 146 MiB | 2,100 |
| Django (tuned) | 132 MiB | 2,000 |
| Flask + Jinja2 | 130 MiB | 2,600 |
| Hono JSX on Bun | 121 MiB | 24,100 |
| Flask (precompiled stdlib) | 110 MiB | 2,900 |
| HonoX on Bun | 97 MiB | 16,100 |
| Laravel + Blade | 97 MiB | 600 |
| React Router 7 on Bun | 94 MiB | 2,600 |
| Next.js static (CSR) | 87 MiB | 30,000+ |

## 5. Odd results, and what fixed them

Where a stack scored far below stacks doing similar work, we profiled it and tried one idiomatic fix, the kind a team would ship. The original numbers stay in the main table; these are the fixed variants.

| Stack | before | after | gain | cause | fix |
|---|---:|---:|---:|---|---|
| SvelteKit (fixed) | 2,500 | 5,600 | 2.2× | A new `Intl.DateTimeFormat` for every post card (21 per page). Building one is expensive (ICU locale data) and it's also why SvelteKit sat at ~800 MB of memory. | Create the formatter once at module scope. |
| Astro (fixed) | 2,300 | 4,900 | 2.1× | The same per-card `Intl.DateTimeFormat`. | Same one-line move. |
| Spring Boot (AOT cache) | 2,900 | 4,300 | 1.5× | Every new container starts with a cold JIT, and the 5-minute hold spends much of its CPU compiling. Virtual threads made it worse. | JDK 25 AOT cache built at image build time. |
| Django (tuned) | 1,600 | 2,000 | 1.3× | The 2 s healthcheck runs inside the 0.4-CPU quota and kept recompiling Python bytecode and templates; the Django template engine is also slow. | Precompiled stdlib bytecode and the Jinja2 backend. |
| Flask (precompiled stdlib) | 2,600 | 2,900 | 1.1× | The same healthcheck bytecode recompilation. | Precompiled stdlib bytecode. |
| ASP.NET (tuned) | 4,900 | 5,300 | 1.1× | About 19% of the CPU went to idle thread-pool spinning. | Thread-pool spin-wait off, ReadyToRun, no background GC, invariant globalization. |
| Laravel Octane | 600 | 700 | 1.2× | PHP-FPM boots the whole framework for every request. | Octane on FrankenPHP keeps it booted: barely helps, because boot was never the main cost. |
| Laravel Octane (tuned) | 600 | 1,900 | 3.2× | No single hotspot: framework floor ~31%, sessions and cookies ~20%, Blade components ~38%, a new API connection per request ~11%. The file session driver also writes one file per cookie-less visitor and its clean-up scans the whole directory, so plain Laravel gets slower as a run goes on. | Octane plus keep-alive to the API, cookie sessions, no XSRF cookie, no Blade timestamp checks, fewer Octane listeners, OPcache JIT, `@include` instead of a component. |
| Next.js (tuned) | 500 | 800 | 1.6× | `cacheComponents` also turns on cached navigations, so every request ran a staged RSC render plus a second "runtime prefetch" render, both useless on pages that are all request-time data; each post card went to the browser twice (HTML and its rendered tree in the RSC payload). | `cacheComponents` off, the post card as a Client Component (props instead of a tree; feed page 45 to 25 KB), V8 heap sized for the container. Still no caching. |

Checked and found nothing wrong: Angular, Qwik and Nuxt (their CPU goes into rendering itself). Node's heap is sized from the host's 31 GB, not the 2 GB limit, which inflates memory numbers but not CPU. Rust's memory at 30,000 users is ~33 KB per open connection. Healthchecks run inside the 0.4-CPU quota for every stack: at idle, a Python healthcheck alone used ~21% of it, a Node one ~8%, a curl one ~2.5%.

