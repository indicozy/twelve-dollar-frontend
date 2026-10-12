# Voice-over script (v3c, Gemma 4 26B paraphrase)

Gemma 4 26B (Q4, 8k context, temperature 0.8) rewrite of VOICEOVER-v3c.md with a style sample from the backend video transcript. Numbers checked by hand; one fix: "the feed goes stale instantly" back to "in seconds".

## 1. Hook (0:00, 9 s)
Does your frontend framework actually matter? Same site, same backend, same $12 server. Next.js hit 500 users. Hono on Bun hit 24,100.

## 2. Scope (0:08, 11 s)
Just to be clear, I'm only testing the server here. I'm not looking at bundle size or how fast it feels in the browser. It's just about the work required to generate the HTML.

## 3. The site (0:19, 9 s)
The app is a tiny Twitter clone. A feed, a post page, likes, and new posts. I built it 33 different ways.

## 4. Setup (0:27, 10 s)
I used two small servers. The API is Rust with SQLite, taking about a millisecond per request. The frontend gets roughly two gigahertz of CPU and 2 gigs of RAM.

## 5. One user (0:37, 10 s)
Each test user is a K6 script. It loads the feed, waits, opens a post, occasionally likes it, and then repeats. About one page every eleven seconds.

## 6. Pass or fail (0:46, 10 s)
The rules: P95 under half a second, P99 under one second, and errors under 1%. If a stack misses any of those, it fails.

## 7. Finding the limit (0:56, 10 s)
So how do I find the limit? I double the users until it breaks, keep halving the gap, and then hold it steady for five full minutes. Express landed at 7,900.

## 8. Every result (1:05, 16 s)
Here's the full list. Rust and the static build blew past my 30,000 cap, so those are just estimates. The Bun stacks held around 24,000. And way down at the bottom, plain Next.js, with 500 users. Honestly, I thought I'd messed something up.

## 9. The big question (1:21, 6 s)
So, why is Next.js this slow?

## 10. Is it RAM? (1:26, 8 s)
My first guess was memory. Nope. Most of the 2 gigs just sat there unused while the CPU was pinned at 100%.

## 11. CPU per request (1:34, 12 s)
So I measured CPU time per request. Next.js burns 8.4 milliseconds on every page. Hono on Bun? 0.17. Your user count is basically your CPU budget divided by that number.

## 12. The React family (1:45, 10 s)
Is it React's fault? Not really. Remix and TanStack Start use the exact same React and handle about five times more users.

## 13. Same React, two ways (1:55, 16 s)
Here's the difference. Remix calls the loader, renders once, and ships about 7 kilobytes of data. Next.js renders Server Components, then renders HTML from them, then ships about 28 kilobytes of that tree inside the page. Same React, five times the CPU.

## 14. Abstraction costs CPU (2:10, 14 s)
If you zoom out, there's a pattern. Plain string templates cost a fraction of a millisecond. Add components, hydration, a server-side DOM, Server Components... every layer costs you more CPU.

## 15. What if we cache Next.js? (2:24, 12 s)
Okay, so just cache it, right? I asked AI to cache everything, and it got me to 800. Doing it properly by hand got me to 3,600. Still not even half of plain Express.

## 16. So why only 3,600? (2:35, 12 s)
Why only 3,600? Because this is a social network. People post every second, every new post is a fresh page to render, and the feed goes stale in seconds. The cache just keeps missing.

## 17. No framework at all (2:47, 11 s)
What about no framework at all? Express with a template engine. 7,900 with EJS, 9,700 with Nunjucks. And the same code on Bun? 24,900. Literally not a rewrite.

## 18. Outside JavaScript (2:57, 11 s)
Outside JavaScript, Go hit 19,000, and Rust held my 30,000 cap using about half its CPU. Laravel started at just 600.

## 19. Profile before you rewrite (3:08, 16 s)
Some results looked wrong, so I profiled them. SvelteKit and Astro were creating a new date formatter for every single post. Moving one line doubled both. Spring, Django, Laravel, and Next.js all saw real wins from small fixes like that.

## 20. Five ways to escape plain Next.js (3:23, 18 s)
If you're on Next.js, you've got five ways out. Tune Next.js itself: 1.6 times. A different runtime: 1.4. A cache in front: 24. Same React, different framework: about 5. Different framework or language: up to a hundred. Bigger rewrites, bigger gains. Caching is the exception.

## 21. What I learned (3:41, 18 s)
So, what did we learn? Abstraction costs CPU. Your language and framework matter a lot, and JavaScript on Bun is plenty fast. AI still can't make your architecture decisions for you. Optimize first, and only rewrite when there's nothing left. And know your tools.
