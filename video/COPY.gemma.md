## 1. Hook
- {users}
- {ratio}×
- users on a tiny server
- same site, same API, same $12 server
- just the frontend changes

## 2. Scope
- in the browser
- client-side rendering
- on the server
- server-side rendering
- the goal
- same HTML, different costs. why?
- what i'm testing
- JS bundle size
- hydration speed
- browser rendering
- Core Web Vitals
- max users per server
- CPU per page
- server memory

## 3. Setup
- load generator
- thousands of users
- 0.4 vCPU · 2 GB
- Rust + SQLite
- ~1 ms per request
- page views
- JSON
- 21 stacks, all rendering on the server
- fresh DB and dedicated core for every run
- the setup
- two small servers
- k6
- frontend server
- API

## 4. OneUser
- {N} users ≈ {N × 0.09} renders/s
- 1 k6 virtual user
- k6 runs thousands of these at once
- 1 user ≈ 0.09 requests/s
- what's a 'user'?
- open the feed
- read for 3-7 s
- open a post
- 15% like · 2% post
- idle 5-15 s

## 5. PassFail
- 5-minute hold
- 60s ramp-up
- 30s ramp-down
- fresh DB and container for every run
- pass or fail
- to pass, for 5 full minutes:
- p95 < 500 ms
- 95% of requests faster
- p99 < 1 s
- 99% of requests faster
- errors < 1%
- hardly anything fails

## 6. SearchPath
- {stack name}: 2m runs, then 5m holds
- score: {users} users
- pass/fail legend
- 2m runs ↓
- 5m holds ↓
- pass
- fail
- finding the limit

## 7. ReactFamily
- Remix & TanStack Start: {ratio}× more users than Next.js
- all three use SSR and hydration
- same React, very different results

## 8. Pipeline
- {ms} ms CPU per request
- Next.js App Router / Remix (React Router 7)
- CPU per request
- where the CPU goes
- turning 20 posts into a page
- fetch data
- 1 API call
- render Server Components
- to a component tree
- render HTML
- from that tree
- inline the tree
- ~28 KB in the page
- gzip
- default Node behavior
- one pass
- embed data
- ~7 KB in the page

## 9. Caching
- Express + EJS {users}
- a cached page costs 0.40 ms CPU (same as Express)
- what if we cache Next.js?

## 10. CacheCosts
- so why only 3,600?
- new posts
- each new post needs a full render first
- writes
- page size
- single thread
- regen and GC block it for ms. p99 breaks first.

## 11. OtherJs
- other JS frameworks

## 12. NoFramework
- rendering the feed: EJS 0.17 ms · Nunjucks 0.08 ms
- no component tree or hydration data. just templates as functions.
- no framework at all
- plain Express on Node

## 13. OtherLangs
- Rust hit our 16k user cap at 45% CPU. Laravel boots the framework every request.
- outside JavaScript

## 14. Leaderboard
- the leaderboard
- 5-minute hold · 0.4 vCPU · 2 GB

## 15. CpuPerRequest
- users ≈
- CPU budget
- ÷ CPU per request
- CPU per request
- ms of CPU per stack limit

## 16. NotRam
- CPU {percent}% / RAM {MiB} MiB
- CPU is maxed, memory isn't. more RAM won't change anything.
- is it RAM?
- at the limit, out of 2 GB

## 17. Takeaways
- takeaways
- with a fast API, the renderer decides your user limit
- compiled string templates win, even in Express
- add CPU, not RAM. or pick a cheaper renderer
