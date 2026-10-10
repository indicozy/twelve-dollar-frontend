# On-screen text for the new v2 shots

## 1. TheSite
- the site
- the same pages, built 21 times
- a tiny Twitter clone
- feed: the 20 latest posts
- post page: one post
- like a post · write a post
- same HTML from every stack

## 2. ResultsTable
- every way we rendered the same page
- 21 stacks · same site · same API · 0.4 vCPU · 2 GB
- users held for 5 minutes
- CPU per request
- · + = stopped at our 16,000-user cap

## 3. StepChip
- why is Next.js slow?
- measure it properly
- is it RAM?
- where does the CPU go?
- is it React?
- just cache everything?
- what if no framework?
- what about other languages?

## 4. NextVsRemix
- same React, two ways to render it
- what happens on the server for every feed request
- Server Components
- run → a Flight tree
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
- only the posts
- shipped in the page: the whole component tree
- shipped in the page: just the data
- Next.js builds the tree twice and ships it · Remix renders once and ships data

## 5. AbstractionLadder
- the answer: abstraction costs CPU
- every layer between your data and the HTML is work, on every request
- a template → strings
- framework templates
- components + hydration data
- a DOM on the server
- Server Components, rendered twice
- less abstraction
- more abstraction → more CPU per page

## 6. TakeawaysV2
- what I took from this
- more abstraction → more CPU per render
- string templates 0.5 ms · Server Components 8.4 ms
- language matters most, but JS is fine for frontend rendering
- Rust hit our cap · Express + Nunjucks held 9,700
- optimize smart: asking AI to “cache everything” never works
- caching took Next.js to 3,600, still under half of Express
- understand the fundamentals
- how your language and tools actually work
- AI makes rewrites fast; rewrite when it's actually needed
- measure first, then decide
