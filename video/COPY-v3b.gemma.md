## 16d. NextHub
- [heading] 5 ways to escape plain Next.js
- [subheading] how much better each group is vs Next.js
- [box 1 title] optimize Next.js itself
- [box 1 subtitle] same app, just less work per request
- [box 1 warning] small gains. plus CSR moves rendering to the browser.
- [box 2 title] swap the runtime
- [box 2 subtitle] same code, just use Bun or Deno
- [box 2 warning] React still does the same amount of work
- [box 3 title] add a cache
- [box 3 subtitle] inside Next.js or in front
- [box 3 warning] only for anonymous pages that can be a second stale
- [box 4 title] keep React, swap the framework
- [box 4 subtitle] one render pass, tiny data blob
- [box 4 warning] you'll have to rewrite routing and data loading
- [box 5 title] swap the framework or language
- [box 5 subtitle] HTML templates, no React
- [box 5 warning] full rewrite. no React in the browser.
- [footer] bigger rewrites give bigger gains. Cache is the exception.

## 3. OtherLangs
- Go hit 19,000 users. Rust hit our 30,000-user cap. Laravel hit 1,900 after profiling.

## 3. ResultsTable legend
- + = hit our 30,000-user cap

## follow-up (gemma4:26b, num_ctx 8192)
- [box 1 warning] still RSC. still way behind
- [takeaway 3 detail] AI "caching" only hit 800 · an nginx cache hit 12,100
