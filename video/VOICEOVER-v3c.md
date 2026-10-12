# Voice-over script (v3c)

Timings match `FullV3b` as rendered to `out/full-v3c-1440p.mp4` (3:59). Voice borrows its style from the backend video
answers (research/captions.txt): first person, "so / now / and honestly", real numbers, a reaction or two, caveats said
out loud. Budget is about 2.6 words per second.

## 1. Hook (0:00, 9 s)
How much does your frontend framework actually matter? Same site, same backend, same $12 server. Next.js: 500 users. Hono on Bun: 24,100.

## 2. Scope (0:08, 11 s)
Now, to be clear, I'm only testing the server here. Not bundle size, not how fast it feels in your browser. Just the work it takes to make the HTML.

## 3. The site (0:19, 9 s)
The app is a tiny Twitter clone. A feed, a post page, likes, new posts. I built it 33 times.

## 4. Setup (0:27, 10 s)
Two small servers. The API is Rust on SQLite, about a millisecond per request. The frontend gets roughly two gigahertz of CPU and 2 gigs of RAM.

## 5. One user (0:37, 10 s)
Each test user is a K6 script. It loads the feed, waits, opens a post, sometimes likes it, then waits and repeats. About one page every eleven seconds.

## 6. Pass or fail (0:46, 10 s)
The rules: P95 under half a second, P99 under one second, errors under 1%. If a stack misses any of those, it fails that level.

## 7. Finding the limit (0:56, 10 s)
So how do I find the limit? Double the users until it breaks, keep halving the gap, then hold it for five full minutes. Express lands at 7,900.

## 8. Every result (1:05, 16 s)
And here's everything. Rust and the static build blew past my 30,000 cap, so those two are estimates. The Bun stacks held around 24,000. And all the way at the bottom, plain Next.js, with 500 users. Honestly, I thought I'd messed something up.

## 9. The big question (1:21, 6 s)
So, why is Next.js this slow?

## 10. Is it RAM? (1:26, 8 s)
My first guess was memory. Nope. Most of the 2 gigs just sat there unused while the CPU was pinned at 100%.

## 11. CPU per request (1:34, 12 s)
So I measured CPU time per request. Next.js burns 8.4 milliseconds on every page. Hono on Bun, 0.17. Your user count is basically your CPU budget divided by that number.

## 12. The React family (1:45, 10 s)
Is it React's fault? Not really. Remix and TanStack Start use the exact same React and handle about five times more users.

## 13. Same React, two ways (1:55, 16 s)
And here's the difference. Remix calls the loader, renders once, and ships about 7 kilobytes of data. Next.js renders Server Components, then renders HTML from them, then ships about 28 kilobytes of that tree inside the page. Same React, five times the CPU.

## 14. Abstraction costs CPU (2:10, 14 s)
And if you zoom out, there's a pattern. Plain string templates cost a fraction of a millisecond. Add components, hydration data, a DOM on the server, Server Components, and every layer costs you more CPU.

## 15. What if we cache Next.js? (2:24, 12 s)
Okay, so just cache it, right? I asked AI to cache everything, and it got me to 800. Doing it properly by hand got 3,600. Still under half of plain Express.

## 16. So why only 3,600? (2:35, 12 s)
So why only 3,600? Because this is a social network. People post every second, every new post is a fresh page to render, and the feed goes stale in seconds. The cache just keeps missing.

## 17. No framework at all (2:47, 11 s)
So what about no framework at all? Express with a template engine. 7,900 with EJS, 9,700 with Nunjucks. And the same code on Bun? 24,900. Literally not a rewrite.

## 18. Outside JavaScript (2:57, 11 s)
Outside JavaScript, Go hit 19,000, and Rust held my 30,000 cap using about half its CPU. Laravel started at just 600.

## 19. Profile before you rewrite (3:08, 16 s)
Some of these results looked wrong, so I profiled them. SvelteKit and Astro were creating a new date formatter for every single post. Moving one line doubled both. Spring, Django, Laravel and Next.js all got real wins from small fixes like that.

## 20. Five ways to escape plain Next.js (3:23, 18 s)
So if you're on Next.js, you've got five ways out. Tune Next.js itself: 1.6 times. A different runtime: 1.4. A cache in front: 24. Same React, different framework: about 5. Different framework or language: up to a hundred. Bigger rewrites, bigger gains. Caching's the exception.

## 21. What I learned (3:41, 18 s)
So what did we actually learn? Abstraction costs CPU. Your language and framework matter a lot, and JavaScript on Bun is plenty fast. AI still can't make your architecture decisions for you. Optimize first, and only rewrite when there's nothing left. And know your tools.
