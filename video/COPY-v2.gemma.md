## 1. TheSite
- the site
- same pages, 21 ways
- a tiny Twitter clone
- feed: 20 latest posts
- post page: one post
- like and write posts
- same HTML from every stack

## 2. ResultsTable
- every way to render the page
- 21 stacks. Same site, API, 0.4 vCPU, 2 GB
- held for 5 minutes
- CPU per request
- + = stopped at our 16,000-user cap

## 3. StepChip
- why is Next.js so slow?
- let's measure it properly
- is it RAM?
- where's the CPU going?
- is it React?
- just cache everything?
- what if no framework?
- what about other languages?

## 4. NextVsRemix
- same React, two ways
- server side per request
- Server Components
- run → Flight tree
- render again
- Flight tree → HTML
- inline the tree
- into <script> tags
- stream + gzip
- in Node
- loader
- → plain JSON
- render HTML
- once
- embed the data
- just the posts
- shipped: the whole tree
- shipped: just the data
- Next.js builds the tree twice. Remix renders once and ships data.

## 5. AbstractionLadder
- abstraction costs CPU
- every layer is extra work per request
- template → strings
- framework templates
- components + hydration data
- a DOM on the server
- Server Components, twice
- less abstraction
- more abstraction = more CPU per page

## 6. TakeawaysV2
- what I learned
- more abstraction = more CPU per render
- string templates 0.5 ms vs Server Components 8.4 ms
- language matters most, but JS is fine for rendering
- Rust hit our cap. Express + Nunjucks held 9,700
- don't just ask AI to “cache everything”. It won't work.
- caching got Next.js to 3,600. Still under half of Express.
- understand the fundamentals
- how your tools actually work
- AI makes rewrites fast. Only rewrite when needed.
- measure first, then decide
