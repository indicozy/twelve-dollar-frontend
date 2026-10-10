# On-screen text, by shot

All text that appears on screen in the video, in shot order. Numbers in {braces} come from the benchmark data
and are filled in at render time. Edit the wording, keep the {data} parts, and paste it back.

## 1. Hook
- {users} (counts up, one per card)
- {ratio}× (stamp between the cards)
- users on one small server
- same site · same API · same $12 server
- only the frontend changes

## 2. Scope
- in the browser
- client-side rendering
- on the server
- server-side rendering
- this video
- every stack sends the same HTML: why does making it cost so differently?
- what this video tests
- JS bundle size
- hydration speed
- rendering in the browser
- Core Web Vitals
- users one server can handle
- CPU to render each page
- server memory

## 3. Setup
- load generator
- thousands of simulated users
- 0.4 vCPU · 2 GB
- Rust + SQLite
- ~1 ms per request
- page views
- JSON
- every page is rendered on the frontend server · 21 stacks tested
- each server pinned to its own core · fresh database for every run
- the setup
- two small servers in a simulated data center
- k6
- frontend server
- API

## 4. OneUser
- {N} users ≈ {N × 0.09} page renders/s (counts up as the crowd fills)
- 1 k6 virtual user
- k6 runs thousands of these loops at once
- 1 user ≈ 0.09 page requests per second
- what is one user?
- open the feed
- read 3-7 s
- open a post
- like 15% · post 2%
- idle 5-15 s

## 5. PassFail
- 5-minute hold
- 60 s ramp-up
- 30 s ramp-down
- fresh database and fresh frontend container before every run
- pass or fail
- a user count passes only if, for 5 full minutes:
- p95 < 500 ms
- 95% of requests faster
- p99 < 1 s
- 99% of requests faster
- errors < 1%
- almost nothing fails

## 6. SearchPath
- {stack name}: every run in order, 2-minute runs then 5-minute holds
- score: {users} users
- pass / fail (legend)
- 2-minute runs ↓
- 5-minute holds ↓
- pass
- fail
- finding the limit

## 7. ReactFamily
- Remix and TanStack Start: about {ratio}× the users of Next.js
- all three render React components on the server · all three hydrate in the browser
- same React, very different results

## 8. Pipeline
- {ms} ms · CPU per request (one per row)
- Next.js App Router / Remix (React Router 7) (row titles)
- CPU per request
- where the CPU goes
- turning the same 20 posts into a page
- fetch data
- 1 API call
- render Server Components
- to a component tree
- render HTML
- from that tree
- inline the tree
- ~28 KB in the page
- gzip
- in Node, by default
- one pass
- embed data
- ~7 KB in the page

## 9. Caching
- Express + EJS {users} (dashed reference line)
- a stored page costs 0.40 ms of CPU: the same as Express rendering one
- what if we cache Next.js?

## 10. CacheCosts
- so why only 3,600?
- new posts
- each new post's page is a full render the first time someone opens it
- writes
- page size
- one thread
- regeneration and garbage collection block it for milliseconds: p99 breaks first

## 11. OtherJs
- the other JS frameworks

## 12. NoFramework
- rendering the feed: EJS 0.17 ms · Nunjucks 0.08 ms
- no component tree, no hydration data: a template compiled to a function, then strings
- no framework at all
- plain Express on the same Node

## 13. OtherLangs
- Rust stopped at our 16,000-user cap at 45% CPU · Laravel boots the framework on every request
- outside JavaScript

## 14. Leaderboard
- the leaderboard
- users held for 5 minutes · 0.4 vCPU · 2 GB

## 15. CpuPerRequest
- users ≈
- CPU budget
- ÷ CPU per request
- CPU per request
- milliseconds of web-server CPU, at each stack's limit

## 16. NotRam
- CPU {percent}% / RAM {MiB} MiB (gauges, one row per stack)
- CPU is full, memory isn't: more RAM wouldn't change a single score
- is it RAM?
- at each stack's limit, out of 2 GB

## 17. Takeaways
- what to take from this
- with a fast API, the HTML renderer decides how many users you serve
- compiled string templates win, even inside plain Express
- add CPU, not RAM, or pick a cheaper renderer
