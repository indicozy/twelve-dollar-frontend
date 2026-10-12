## 1. FourWays (new labels)
- nginx microcache
- Express + Nunjucks on Bun:

## 2. FixFirst
- before you rewrite, profile it
- odd results we dug into, and the small fix for each
- a date formatter created 21 times per page
- the same date formatter bug
- cold JIT in every new container, fixed with a JDK AOT cache
- health check recompiled Python every 2 s, plus Jinja2
- health check recompiled Python every 2 s
- idle thread-pool spinning turned off
- a session file per visitor, a new API connection per request
- moving one line more than doubled SvelteKit and Astro

## 3. OtherLangs
- Go and Rust hit the 16,000-user cap. Laravel climbs to 1,900 once it's profiled.
