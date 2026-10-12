## 16d. NextHub (Next.js in the middle, five boxes around it, each with its best result vs plain Next.js)
- [heading] five ways out of plain Next.js
- [subheading] best result in each group vs plain Next.js
- [box 1 title] tune Next.js itself
- [box 1 subtitle] same app, less work per request
- [box 1 warning] small gain, and CSR moves rendering to the browser
- [box 2 title] swap the runtime
- [box 2 subtitle] same code on Bun or Deno
- [box 2 warning] React's rendering work stays the same
- [box 3 title] add a cache
- [box 3 subtitle] inside Next.js or in front of it
- [box 3 warning] only for anonymous pages that can be a second stale
- [box 4 title] keep React, swap the framework
- [box 4 subtitle] one render pass, small data blob
- [box 4 warning] rewrite routing and data loading
- [box 5 title] swap framework or language
- [box 5 subtitle] HTML templates, no React
- [box 5 warning] full rewrite, no React in the browser
- [footer] the bigger the rewrite, the bigger the gain. The cache is the exception.

## 3. OtherLangs
- Go hit 19,000 users and Rust held our 30,000-user cap. Laravel hit 1,900 after profiling.

## 3. ResultsTable legend
- + = stopped at our 30,000-user cap
