# Voice-over script (v2)

Timings match `FullV2` (`out/full-v2d.mp4`). Word budget is about 2.4 words per second.

## 1. Hook  (0:00, 9s, 21 words / max 21)
Same website. Same backend. Same twelve-dollar server. Next.js held 500 users. Express held 9,700. So why is Next.js nineteen times slower?

## 2. Scope  (0:08, 11s, 27 words / max 26)
Quick note: I'm only testing the server. Not bundle size, not how the page feels in your browser. Just the work it takes to make the HTML.

## 3. TheSite  (0:19, 9s, 21 words / max 21)
The site is a tiny Twitter clone. A feed, a post page, likes and new posts. I built it 21 times.

## 4. Setup  (0:27, 10s, 23 words / max 24)
Two small servers. The API is Rust on SQLite, about a millisecond per request. The frontend server is the thing I swap out.

## 5. OneUser  (0:37, 10s, 24 words / max 24)
Each user is a k6 script. Open the feed, read, open a post, maybe like it, then idle. About one page every eleven seconds.

## 6. PassFail  (0:46, 10s, 24 words / max 24)
A level passes if 95% of requests finish under half a second, 99% under a second, and almost nothing errors. For five full minutes.

## 7. SearchPath  (0:56, 10s, 22 words / max 24)
Then I search. Probe, cut the range in half, and hold the best level for five minutes. Here's Express finding its limit.

## 8. ResultsTable  (1:05, 16s, 28 words / max 38)
And here's everything. Rust and the client-side build hit my 16,000 cap. Express with Nunjucks held 9,700. And all the way at the bottom, plain Next.js, with 500.

## 9. BigQuestion  (1:21, 6s, 6 words / max 14)
So why is Next.js so slow?

## 10. NotRam  (1:26, 8s, 16 words / max 19)
First guess: memory. Nope. Most of the 2 gigs sat unused while the CPU was pinned.

## 11. CpuPerRequest  (1:34, 12s, 20 words / max 28)
So I measured CPU time per request. Next.js spends 8.4 milliseconds on every page. Express spends about half a millisecond.

## 12. Pipeline  (1:45, 12s, 22 words / max 28)
Here's where it goes. Next.js renders Server Components, then renders HTML from that, then puts the whole component tree into the page.

## 13. ReactFamily  (1:57, 10s, 19 words / max 24)
Is it React? No. Remix and TanStack Start use the same React and handle about five times more users.

## 14. NextVsRemix  (2:06, 16s, 30 words / max 38)
Remix calls the loader, renders once, and ships 7 kilobytes of data. Next.js builds the tree twice and ships around 28 kilobytes of it. Same React, five times the CPU.

## 15. Caching  (2:22, 12s, 28 words / max 28)
Okay, so just cache it? When I asked AI to cache everything, I got 800 users. Doing it properly got me to 3,600. Still under half of Express.

## 16. CacheCosts  (2:33, 12s, 28 words / max 28)
The cache isn't the expensive part. New posts still need full renders, writes go through heavier route handlers, and background work blocks the one thread. p99 breaks first.

## 17. NoFramework  (2:45, 11s, 22 words / max 26)
What about no framework at all? Express with a template engine. 7,900 with EJS, 9,700 with Nunjucks. Even the template engine matters.

## 18. OtherLangs  (2:55, 11s, 27 words / max 26)
Outside JavaScript, Rust hit my cap without breaking a sweat, ASP.NET did 4,900, and Laravel landed next to Next.js. PHP boots the whole framework on every request.

## 19. FourWays  (3:06, 14s, 36 words / max 33)
So, four levers. Caching got 7 times. A new framework, 19. Moving Next.js to Bun, only 500 to 700. A new language, even more. Each has a price, and this test can't see architecture or readability.

## 20. AbstractionLadder  (3:19, 14s, 29 words / max 33)
Line it all up and the pattern is simple. Every layer between your data and the HTML costs CPU on every request. Templates are cheap. Server Components are not.

## 21. TakeawaysV2  (3:33, 18s, 45 words / max 43)
What I took from this. More abstraction, more CPU per render. Language and framework matter a lot, but JavaScript is fine for frontend rendering. Asking AI to cache everything won't save you. AI makes rewrites fast, so rewrite when it's needed. And know your tools.
