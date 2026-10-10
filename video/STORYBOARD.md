# Storyboard: "How many users can your frontend serve on a $12 server?"

Format: 1920×1080, 30 fps, whiteboard explainer look (hand-drawn boxes, handwriting font, pastel fills, one group
colour per kind of renderer). Talking head is composited separately by the editor (a free corner is left on most
shots). All numbers come from `report/data.json` (the benchmark results), so the video re-renders after new runs.

Colour code used everywhere:
- **blue** = SSR + hydration (JS frameworks: Next.js, Remix, SvelteKit, Nuxt, …)
- **orange** = server templates, no hydration (Express, Flask, Django, ASP.NET, Laravel, Spring, Rust, Astro)
- **green** = static files + API (client-side rendering)

## The story in one line

Same site, same API, same tiny server: the only thing that changes is the frontend, and that alone changes how many
users the box can serve by 20×. The reason is almost entirely how much CPU each framework spends turning data into
HTML.

## Key points (in order)

1. The bottleneck is the HTML renderer, not the data: the Rust API sat at 3-14% CPU while every frontend maxed out.
2. Next.js App Router is the slowest out of the box (500 users): it renders twice (Server Components, then HTML) and
   ships the component payload in the page. Remix and TanStack Start render the same React in one pass: 5× more users.
3. Caching Next.js helps 7× (500 → 3,600) but stops at half of plain Express: a cache hit is cheap (0.40 ms), the work
   around it (new posts, route handlers, background regeneration, GC) isn't, and it shows up first in p99.
4. No framework at all is the fastest Node option: Express + Nunjucks 9,700, Express + EJS 7,900. Template engines
   differ 2× in render cost.
5. Outside JS: Rust and ASP.NET lead, Laravel lands next to Next.js (framework boot on every request).
6. It's CPU, not RAM: servers hit 95-100% CPU with most of their 2 GB unused.
7. Client-side rendering moves the work to the visitor's device: 16,000+ users, at a different cost.

## Shot list

| # | Shot | ~s | On screen | Narration (draft) |
|---|---|---:|---|---|
| 1 | Hook | 9 | "same site · same API · same $12 server" writes on; then two numbers count up: **500** (Next.js) and **9,700** (Express + Nunjucks); "19×" stamp | "Same website, same backend, same twelve-dollar server. The only difference is the frontend framework, and one handles 19 times more users than the other." |
| 1b | Scope | 11 | Two halves: "in the browser" (bundle size, hydration, browser rendering, Core Web Vitals) gets crossed out; "on the server" (users per server, CPU per page, latency under load, memory) is highlighted as "this video"; closing line "every stack sends the same HTML: why does making it cost so differently?" | "This isn't about how fast pages feel in the browser. It's only about the server: how much work it takes to make the HTML, and why that differs so much." |
| 2 | The setup | 12 | Three boxes draw in left→right: **k6** (load generator) → **frontend server** (0.4 vCPU · 2 GB) → **API** (Rust + SQLite); arrows; "every page rendered on the server" | "Two small servers. The API is a Rust server on SQLite, and it's fast: about a millisecond per request. The frontend is what we swap: 21 stacks." |
| 3 | One user | 12 | A loop of four steps drawn as a circle (open feed → read 3-7 s → open post → like / post → idle); then a grid of user icons fills; "1 user ≈ 0.09 page requests/s" | "One simulated user browses the feed, opens a post, sometimes likes it, then rests. About one page every eleven seconds." |
| 4 | Pass or fail | 12 | Three pills: **p95 < 500 ms**, **p99 < 1 s**, **errors < 1%**; a ramp-hold-rampdown timeline with "5-minute hold" | "A level passes only if 95% of requests finish in half a second, 99% in one second, and almost none fail, for five full minutes." |
| 5 | Finding the limit | 12 | Express's real search path: dots placed on a users axis, green pass / red fail, converging on 7,900 | "We probe, bisect, then hold. Here's Express finding its limit." |
| 6 | React family | 11 | Bars: Next.js 500, Remix 2,500, TanStack Start 2,700 | "Same React, very different results." |
| 7 | Why Next.js is slow | 12 | A pipeline: data → **render Server Components** → **render HTML** → **inline payload (28 KB)** → gzip; vs Remix: data → **render HTML** → **7 KB data** | "Next.js renders your page twice and sends the component tree along with it. Remix renders once." |
| 8 | Caching Next.js | 13 | Bars: 500 → 800 → 3,500 → 3,600, with Express 7,900 as a dashed line; callout "a cache hit costs 0.40 ms = Express rendering" | "Caching helps seven times. But a cache hit already costs as much as Express rendering the page." |
| 9 | Where the cached CPU goes | 12 | Four small cards: new posts = full renders · route handlers 5× Express · pages 3× bigger · background work blocks the one thread → p99 | "The cache isn't the cost; everything around it is, and it shows in the slowest 1% of requests first." |
| 10 | Other JS frameworks | 11 | Bars: Angular 700, Qwik 1,800, Nuxt 1,900, Astro 2,300, SvelteKit 2,500, SolidStart 3,300 | "Frameworks that compile templates to strings do best; Angular builds a whole DOM on the server." |
| 11 | No framework | 11 | Two bars: Express + EJS 7,900, Express + Nunjucks 9,700; small note "render: 0.17 ms vs 0.08 ms" | "Plain Express beats every framework. Even the template engine matters." |
| 12 | Other languages | 11 | Bars: Laravel 600, Django 1,600, Flask 2,600, Spring 2,900, ASP.NET 4,900, Rust 16,000 cap | "Rust hit our cap without breaking a sweat. Laravel boots the whole framework on every request." |
| 13 | Leaderboard | 14 | All 21 bars, sorted, coloured by group | "Here's everything." |
| 14 | CPU per request | 12 | Bars of CPU ms per request; equation "users ≈ CPU budget ÷ CPU per request" | "Every server ran out of CPU. Divide the budget by what each request costs, and you get the leaderboard." |
| 15 | Not RAM | 8 | Two gauges per stack: CPU 95-100% full, RAM ~20% full | "More RAM wouldn't help. More CPU, or a cheaper renderer, would." |
| 16 | Takeaways | 12 | Three lines write on | "Measure your renderer. Cache carefully. And sometimes the boring option wins." |

Total: about 3 minutes of animation. The editor adds the talking head, b-roll of terminals/k6 output and music.

## Build order

1. Design system: palette, handwriting font, hand-drawn rectangles/arrows (rough.js, seeded so frames are stable),
   draw-in and grow-in helpers, a data-driven bar chart.
2. Shots 1, 2, 3, 13 first (they set the look), then the rest.
3. Render each shot as its own composition (easy to drop into an editor) plus one `Full` composition.
