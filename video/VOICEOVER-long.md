# Voice-over script, long cut

Rewritten from your recorded take (`recordings/take-162340-final.wav`, 12:15 after cutting pauses): your wording and
order, cleaned up, with the numbers checked against `report/data.json`. The 22 slides are the ones in the video
(`FullV3b`, `out/full-v3d-1440p.mp4`); times are where each slide starts in the video before it's stretched to fit.
Numbers are the rounded estimates you used in the recording.
The previous draft is in `VOICEOVER-long-draft.md`.

## 1. Hook (0:00)
How much does your frontend framework actually matter? I took one small website, one backend and one $12 server, and I built the frontend 33 different ways. Plain Next.js handled 500 users, but Hono on Bun handled 24,100. On the same server, that's about 50 times more users, and I wanted to know where all that difference comes from.

## 2. Scope (0:08)
To be clear, I'm only testing the server. I'm not testing the client side: not bundle size, not how fast the page feels, not the Lighthouse score. I'm just answering one question: how much work does one server do to render the HTML for the first page load, and how many people can it handle before it falls over?

## 3. The site (0:19)
The app is a tiny Twitter clone. There's a feed with the 20 newest posts, a page for each post, likes, and a form to write a new post. The database has 50,000 users, 500,000 posts and a little over 2 million likes. Every version renders the same markup with the same stylesheet, so the HTML comes out basically identical. The only thing that changes is how it gets made. And I tried pretty much everything: Next.js, Remix, TanStack Start, SvelteKit, Nuxt, SolidStart, Qwik, Angular, Hono and HonoX, plain Express with templates. 33 stacks, each with its own settings and defaults, and a few cached versions of Next.js as well.

## 4. Setup (0:27)
The setup is two small servers. One runs the API, written in Rust with SQLite, and it answers the feed in about a millisecond. On a full core it can serve almost 40,000 feeds a second, so it's never the bottleneck. The other box runs the frontend. It has 2 gigabytes of RAM and 40% of one CPU core, which works out to about 2 gigahertz. And the users are simulated by K6, which can generate thousands of users to benchmark the frontend servers.

## 5. One user (0:37)
So what is a user? For that I'm using K6. Each virtual user has their own account. They load the feed, wait a few seconds, open a post, wait again, sometimes they like it, sometimes they write a post, and they repeat. That's about a tenth of a request per second per user, so 1,000 users is roughly 90 requests a second.

## 6. Pass or fail (0:46)
The rules of this test: P95 latency has to be under 500 milliseconds, P99 under one second, and errors well under 1%. And I test it with a five-minute hold at the maximum, so the final number is the most users a stack can hold for a full five minutes.

## 7. Finding the limit (0:56)
So how do I find the limit? I double the users until it breaks, then keep halving the gap between the last pass and the first fail, like a binary search. And once I've found the number that's closest to the max, I run five-minute holds inside that range.

## 8. Every result (1:05)
And here are the results. On top, as usual, it's Rust and the static build of Next.js, both past my 30,000-user cap, so for those two I'm showing estimates: about 50,000 for Rust and 40,000 for the static website. Then there are the Bun stacks, around 24,000. Then the middle, with Bun and Node.js server rendering. Then lower down, starting from 6,600, most of the SSR frameworks, like Next.js, SvelteKit, Remix, Astro and Ruby on Rails. And all the way at the bottom there's Next.js, with 500 users. At first I thought something was broken, so I checked the build, checked the config and ran it again, but it was still 500 users.

## 9. The big question (1:21)
So the question is: why is Next.js so slow?

## 10. Is it RAM? (1:26)
My first guess was memory, but no. At its limit, Next.js was using only about 400 megabytes out of 2 gigabytes. Meanwhile, the CPU was pinned at 95 to 100%. The only bottleneck was the frontend's CPU, not the RAM.

## 11. CPU per request (1:34)
So I measured how much CPU each request actually burns. Next.js spends about 8.5 milliseconds of CPU on each request, while Express takes about half a millisecond, Hono about a fifteenth of a millisecond, and Rust about eight hundredths of a millisecond. So you can see that basically the whole budget goes to the CPU, and it shows in the leaderboard.

## 12. The React family (1:45)
Maybe it's React's fault? No, not really. Remix and TanStack Start have exactly the same React, but they hold five times more users than Next.js. So the issue isn't React by itself.

## 13. Same React, two ways (1:55)
Because if we dig further, we can see that Remix has a much simpler rendering pipeline than Next.js. Remix just calls the loader, renders the HTML once, and embeds about 7 kilobytes of data so the browser can hydrate it. But Next.js renders the server component tree and serializes it, then renders HTML from that tree, then puts about 28 kilobytes of that tree inside the page. So the feed page becomes 46 kilobytes against 19 for Remix, and it takes five times more CPU with the same React.

## 14. Abstraction costs CPU (2:10)
And if you zoom out, you can see a pattern. Plain string templates are the cheapest, simplest and fastest way to do server-side rendering. And as you add components, hydration, a DOM on the server, and then Server Components, every layer you add to the rendering pipeline adds to the server's load.

## 15. What if we cache Next.js? (2:24)
Okay, but we can just cache it, right? So I asked AI to cache everything, and it cached the data, which got me to only 500 users. But fetching the data was never the expensive part. The feed was still rendered on every request. Doing it properly by hand, caching the whole page and refreshing it every 15 seconds, got 3,600.

## 16. Four ways to cache Next.js (2:35)
The expensive part was generating all the posts that users were watching. But even if you cache the full page, you still only get about half of plain Express.

## 17. So why only 3,600? (2:50)
So why does the cache stop at 3,600? Serving a cached page is actually cheap, about the same as Express rendering it from scratch. The problem is how the app works: the issue is everything around the cache. It's a social network, and people post every second. So every new post needs a new page to render, and there's too much writing compared to reading for a simple cache to handle. And because of that, the first thing that failed was P99, not P95.

## 18. No framework at all (3:02)
But what if we don't use any framework at all? If you use plain Express with a template engine, it gets to around 7,900 users, compared to 3,300 for the best SSR framework. And if you optimize that, Express with Nunjucks on Bun, you can push it up to 25,000, which is close to Go and Rust. So JavaScript itself has the potential to go much higher than Next.js: about 50 times higher than plain Next.js.

## 19. Outside JavaScript (3:12)
Outside JavaScript, the best ones were of course Go and Rust, with 20,000 and an estimated 50,000. But we can also see that Laravel, Django and Rails are much slower, similar to JavaScript SSR.

## 20. Profile before you rewrite (3:24)
But some of the results looked wrong to me, so I profiled them. In SvelteKit and Astro I found a small bug: a date formatter was being created for every single post. Just by moving that one line, I doubled the speed of both, and SvelteKit went from 2,500 to 5,600. Laravel was booting up on every request, which also takes time, so I optimized that, and it went from 600 to 1,900. Spring, Django and Next.js also had small wins from small config fixes. So it shows that maybe you don't even need to change the framework or the architecture. Maybe you just need to optimize the code.

## 21. Five ways to escape plain Next.js (3:38)
If you're using Next.js today, you've optimized your code and you still need more, what can you do about it? First, you can optimize Next.js itself by tuning the config, like disabling the gzip compression. Second, you can use another runtime, which gives about 40%. For example, Bun took it from 500 to 700. Third, you can make a proper smart cache, which is a bit of a hassle to do, but depending on your app it can get you up to 24 times. Fourth is to switch from Next.js to another framework. If you go from Next.js to React Router or TanStack Start, you can get five times the server-side performance. And finally, the most aggressive option is to switch to a compiled language like Go or Rust, which can handle 20,000 to 50,000 users on a single server.

## 22. What I learned (3:56)
So what did I actually learn? The more abstraction, the more CPU time for rendering, so keep your rendering pipeline simple. Picking the right language and framework matters a lot. Even on the frontend, server-side rendering frameworks like Next.js or SvelteKit are much slower than plain template rendering, but JavaScript itself is more than fast enough. Don't ask AI to make architecture decisions like "cache everything"; most of the time it won't work. You need to pick the right configuration and setup for your own project. And when you actually need the performance gains, AI can help you make the rewrite fast. But only do it when you actually need it. You don't need to switch frameworks or languages unless you have to. But if you have no other choice, then you can consider it.
