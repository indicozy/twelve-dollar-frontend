# Voice-over script, long cut

Only the 22 slides that are in the video (`FullV3b`, `out/full-v3d-1440p.mp4`), in the same order. Each slide gets
stretched to fit the recording. Every number comes from `report/data.json` or the analysis report.

## 1. Hook (0:00)
How much does your frontend framework actually matter? I took one small website, one backend, and one $12 server, and I built the frontend 33 different ways. Plain Next.js handled 500 users. Hono on Bun handled 24,100. Same page, same server. That's almost fifty times more users, and I wanted to know where all that difference comes from.

## 2. Scope (0:08)
Now, to be clear about what this video is. I'm only testing the server. Not bundle size, not how fast the page feels in your browser, not Lighthouse scores. Just one question: how much work does the server do to turn data into HTML, and how many people can it handle before it falls over?

## 3. The site (0:19)
The app is a tiny Twitter clone. There's a feed with the 20 newest posts, a page for each post, likes, and a form to write a new post. The database has 50,000 users, 500,000 posts and a little over 2 million likes. Every version renders the same markup with the same stylesheet, so the HTML that comes out is basically identical. The only thing that changes is how it gets made. And I tried pretty much everything: the big JavaScript frameworks, plain templates, Go, Rust, Elixir, C#, Java, Python, Ruby and PHP.

## 4. Setup (0:27)
The setup is two small servers. One runs the API, written in Rust on SQLite, and it answers the feed in about a millisecond, so it's never the bottleneck. The other box runs the frontend. It gets 2 gigs of RAM, no swap, and about 1.96 gigahertz of CPU. I throttled it because a modern desktop core is way faster than the shared CPU you actually get on a $12 droplet. And I'm not an expert in all of these frameworks, so I kept every one close to its default production setup. Gzip stays on in Next.js, CSRF stays on in Django and Laravel, and nothing is cached unless the variant says so.

## 5. One user (0:37)
So what is one user? I'm using K6. Each virtual user has their own account. They load the feed, wait a few seconds, open a post, wait again, sometimes like it, sometimes write a post, and repeat. That's about one page every eleven seconds per user. So 1,000 users is roughly 90 requests a second.

## 6. Pass or fail (0:46)
The rules: P95 latency under half a second, P99 under one second, and errors under 1%. If a stack misses any one of those, it fails at that level. And it's not enough to survive a short burst. The final number is the most users a stack can hold for five full minutes. Every run starts from a fresh copy of the database and a fresh container.

## 7. Finding the limit (0:56)
So how do I find the limit? Double the users until it breaks, then keep halving the gap between the last pass and the first fail. Once the range is tight, I run five-minute holds inside it. Plain Express on Node, for example, lands at 7,900 users, about 730 requests a second.

## 8. Every result (1:05)
And here's everything. At the top, Rust and the static build blew straight through my 30,000-user cap, so for those two I'm showing an estimate: about 50,000 for Rust and about 42,000 for the static site. Then the Bun stacks, around 24,000. Then a long middle. And all the way at the bottom, Next.js with 500 users, about 45 requests a second. Honestly, the first time I saw that I thought I'd broken something. So I checked the build, checked the config, ran it again. Still 500. One machine, one run per level, so treat anything within about 10% as a tie. But the top and the bottom don't move.

## 9. The big question (1:21)
So, why is Next.js this slow?

## 10. Is it RAM? (1:26)
My first guess was memory. Nope. At its limit Next.js used about 400 megabytes out of 2 gigs. Nothing swapped, nothing crashed. Meanwhile the CPU was pinned at 95 to 100%. And that's true for every server-rendered stack here: they all ran out of CPU, not RAM. More memory would buy you nothing.

## 11. CPU per request (1:34)
So I measured how much CPU each request actually burns. Next.js spends 8.4 milliseconds of CPU on every page. Express with EJS, about half a millisecond. Hono on Bun, 0.17. Rust, 0.08. And once you have that number, the user count is basically your CPU budget divided by it. That's the whole leaderboard in one chart.

## 12. The React family (1:45)
So is it React's fault? Not really. Remix and TanStack Start use the exact same React and the exact same components, and they hold 2,500 and 2,700 users. About five times Next.js.

## 13. Same React, two ways (1:55)
And here's the difference. Remix calls the loader, renders the page once, and embeds about 7 kilobytes of data so the browser can hydrate. Next.js renders the Server Components into a serialized tree, then renders HTML from that tree, then puts about 28 kilobytes of that tree inside the page. The feed page ends up at 46 kilobytes against about 19 for Remix. Same React, roughly five times the CPU.

## 14. Abstraction costs CPU (2:10)
And if you zoom out, there's a pattern. Plain string templates are the cheapest thing you can do. Add components, then hydration data, then a whole DOM on the server, then Server Components, and every layer costs more. Qwik serializes component state into the page so the browser never re-runs anything, and that work moves to your server. Angular builds a full DOM on the server for every request and lands at 700, right next to Next.js. Every layer you add on the server, you pay for on every single request.

## 15. What if we cache Next.js? (2:24)
Okay, so just cache it, right? I asked AI to cache everything, and it cached the data. Which got me to 800, because fetching data was never the expensive part. The feed was still rendered on every request. Doing it properly by hand, caching the whole feed page and refreshing it every 15 seconds, got 3,600. Still under half of plain Express.

## 16. Four ways to cache Next.js (2:35)
Here are the four setups side by side. The AI version cached the data, so the API call was skipped, but Next.js still rendered the feed on every request. That's the expensive part, so it barely helped: 800. The full cache stores the whole feed page and rebuilds it every 30 seconds: 3,500. The smart cache rebuilds it every 15 seconds, and the browser asks the API for like counts directly, so likes never touch Next.js: 3,600. And nginx in front stores the feed for one second and posts for five. A cache hit never even wakes up Node, so Next.js only renders about one feed a second, plus new posts and signed-in users. That's 12,100 users.

## 17. So why only 3,600? (2:50)
So why does the cache stop at 3,600? Serving a cached page is actually cheap, about the same as Express rendering it from scratch. The problem is everything around it. This is a social network. People post every second, every new post is a fresh page to render the first time someone opens it, and the feed goes stale in seconds. Likes go through route handlers that cost five times what they cost in Express. And every render or garbage collection blocks Node's single thread, so the slowest 1% of requests pile up behind it. That's what failed: P99, not P95.

## 18. No framework at all (3:02)
So what about no framework at all? Plain Express with a template engine. 7,900 users with EJS. 9,700 with Nunjucks, because Nunjucks compiles the whole page into one function. And the exact same Nunjucks code on Bun? 24,900 users, about 2,300 requests a second. Literally not a rewrite. Bun does the HTTP layer in native code, and for a light app that was most of the work. Next.js on Bun only went from 500 to 700, because its cost is React and its own JavaScript, and that's the same on any runtime.

## 19. Outside JavaScript (3:12)
Outside JavaScript, Go hit 19,000. Rust held my 30,000 cap at about half its CPU, with a P95 of one millisecond. Its templates compile to Rust code at build time, so rendering is just writing into a buffer. Phoenix got 8,500, ASP.NET around 5,000, and Spring 2,900. And Laravel started at just 600.

## 20. Profile before you rewrite (3:24)
Some of these results looked wrong, so I profiled them. SvelteKit and Astro were creating a new date formatter for every single post card, on every page. Moving that one line more than doubled both: SvelteKit went from 2,500 to 5,600. Laravel had sessions, cookies, Blade components and a new API connection on every request, and fixing those took it from 600 to 1,900. Spring, Django and Next.js got real wins from small fixes like that too. In Next.js, one config flag was making every request render the page twice. Turning it off and passing the post cards to a client component took it from 500 to 800. None of these fixes change what the page does. They just stop work nobody asked for. So before you pick a new framework, run a profiler.

## 21. Five ways to escape plain Next.js (3:38)
So if you're on Next.js today, you've got five ways out, roughly in order of effort. Tune Next.js itself: 1.6 times. A different runtime: 1.4. A cache in front: 24 times, but only if your pages are the same for every visitor and can be a little stale. Same React, different framework: about 5. Different framework or language: up to a hundred. And if you still want interactivity, HonoX hydrates just the like button and held 16,100. Bigger rewrites, bigger gains. Caching is the exception.

## 22. What I learned (3:56)
So what did I actually learn? Abstraction costs CPU, on every request. Your framework matters a lot, and JavaScript is plenty fast when it runs on Bun and isn't buried under layers. AI still can't make your architecture decisions for you; it cached the wrong thing. Optimize first: profile, fix the silly stuff, tune the config, and only rewrite when there's nothing left. And know your tools. If you're an expert in one of these frameworks and you'd do something differently, tell me in the comments, because I don't think this experiment is over.
