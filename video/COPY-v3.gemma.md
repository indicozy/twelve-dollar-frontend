## 1. FourWays
- nginx microcache
- Express + Nunjucks on Bun

## 2. FixFirst
- profile before you rewrite
- weird results and the small fixes we used
- date formatter created 21x per page
- the same date formatter bug
- cold JIT in every container. fixed with JDK AOT cache
- health check recompiled Python and Jinja2 every 2 s
- health check recompiled Python every 2 s
- turned off idle thread-pool spinning
- one session file per visitor and one API connection per request
- one extra line doubled SvelteKit and Astro

## 3. OtherLangs
- Go and Rust hit the 16,000-user cap. Laravel hit 1,900 after profiling.
