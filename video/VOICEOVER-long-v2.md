# Voice-over script, long version (v2)

Written to be read at a relaxed, conversational pace (about 165 words per minute). It is longer than the current
animation (3:51), so the shots need to be stretched to fit the recording: the estimated length of each part is next to
its heading. The short version is still in `VOICEOVER.md`. Total: about 1,580 words, roughly 9½ minutes.

## 1. Hook  (~34 s)

So I built the exact same website twenty-two times. Same pages, same backend, same tiny twelve-dollar server. The only
thing I changed was the frontend framework. And the results were kind of wild. Next.js, the most popular React
framework out there, handled 500 users before it fell over. Plain old Express with a template engine handled 9,700. On
the same box. That's nineteen times more people. So in this video I want to figure out why Next.js is so much slower,
and what that actually means for the stuff you and I build.

## 2. Scope  (~27 s)

Quick disclaimer before we start. I'm only testing the server here. I'm not measuring bundle size, or how snappy the page
feels once it's in your browser, or Core Web Vitals. All of that matters, but it's a different video. This one is only
about one question: how much work does the server do to turn some data into HTML? Because on a cheap server, that work
is the thing you pay for.

## 3. The site  (~28 s)

The site itself is a tiny Twitter clone. There's a feed with the twenty latest posts, a page for a single post, you can
like things, and you can write a post. Nothing fancy. Then I rebuilt that same site in every framework I could think of:
Next.js, Remix, SvelteKit, Nuxt, Angular, Express, Django, Laravel, Rust and a bunch more. Same markup, same CSS, same
data, so the only difference is how each one renders the page.

## 4. Setup  (~35 s)

For the setup, I've got two small servers. One runs the API: it's written in Rust on top of SQLite, with fifty thousand
users and half a million posts, and it answers a feed request in about a millisecond. I wanted the backend to be so fast
it basically disappears from the picture. The other server is the frontend, the thing I swap out. Each one gets 0.4 of a
CPU and 2 gigs of RAM, because a core on my desktop is a lot faster than the shared core you get on a cheap VPS.

## 5. One user  (~24 s)

To simulate traffic I used k6. Each virtual user behaves like a real person scrolling: open the feed, read for a few
seconds, open a post, maybe like it, sometimes write something, then wander off for a bit. Put together, one user asks
for a page roughly every eleven seconds. So a thousand users is about ninety pages a second that the server has to
render.

## 6. Pass or fail  (~21 s)

Now, what counts as "handling" a number of users? I used the same rules as the backend video this one is based on.
Ninety-five percent of requests have to come back in under half a second, ninety-nine percent in under a second, less
than one percent can error, and it has to hold that for five full minutes.

## 7. Finding the limit  (~32 s)

Finding the limit is basically a binary search. I fire a quick probe to get a rough idea, jump up and down until I've got
a pass and a fail, then cut the gap in half until I'm within a hundred users. Then I hold that number for five minutes to
make sure it's real. And that last step matters. Look at Express here: it passed 8,000 users for two minutes, but over
five minutes it started to crack, and the real number ended up being 7,900.

## 8. Results  (~27 s)

Okay, here's everything. At the top, Rust and the client-side version of Next.js both hit my cap of 16,000 users, which
is just where I stopped testing. Then Express with Nunjucks at 9,700, Express with EJS at 7,900, ASP.NET at 4,900. Then
there's this big cluster of JavaScript frameworks somewhere between about 1,800 and 3,600. And then, all the way at the
bottom, below Laravel, below Angular, is plain Next.js. Five hundred users.

## 9. Big question  (~3 s)

So why is Next.js so slow?

## 10. Is it RAM?  (~20 s)

My first guess was memory. React apps aren't exactly known for being light. But no. At its limit, Next.js was using
around 400 megabytes out of its 2 gigs. The CPU, on the other hand, was pinned at basically a hundred percent. So
throwing more RAM at it would do nothing. This is a CPU problem.

## 11. CPU per request  (~25 s)

So I measured how much CPU time each request actually costs. And this is where it clicked for me. Next.js spends about 8.4
milliseconds of CPU on every single page. Express spends about half a millisecond. And once you know that, the whole
leaderboard is just division: take the CPU you have, divide it by what one page costs, and that's roughly how many users
you can serve.

## 12. Where the CPU goes  (~27 s)

So where do those 8 milliseconds go? With the App Router, Next.js first runs your Server Components and turns them into
something called the Flight payload, which is a serialized version of your whole component tree. Then it takes that and
renders it again into HTML. Then it embeds the payload into the page so the browser can hydrate. And then it gzips all of
it, in Node, on that same single thread.

## 13. Is it React?  (~17 s)

At this point I started wondering if React itself is just slow. So I checked the other React frameworks. Remix held 2,500
users and TanStack Start held 2,700, with the same React. That's about five times more than Next.js. So no, React isn't
the main problem here.

## 14. Next.js vs Remix  (~29 s)

Here's the difference side by side. Remix calls your loader, gets plain JSON back, renders the page once, and drops about
7 kilobytes of data into the HTML so the browser can pick up where the server left off. Next.js builds the tree, renders
it a second time, and ships around 28 kilobytes of that tree inside the page. That's every div and every prop, written out
as JSON. Same components, same React, and about five times the CPU per request.

## 15. Caching  (~32 s)

Okay, so the obvious fix: just cache it. And honestly, this is what I did first. I asked AI to "cache everything", and it
cached the data. Which got me from 500 to 800 users. The problem is, the data was never the expensive part, the rendering
was. So I did it properly: cache whole pages, refresh the feed on a timer, only re-render a post when its author edits
it. That got me to 3,600. Seven times better. And still less than half of plain Express.

## 16. Why caching stops there  (~32 s)

And the cache hit itself isn't the issue. Serving a stored page cost Next.js about 0.4 milliseconds when I measured it on
its own, which is about what Express needs to render the page from scratch. The cost is everything around the cache.
Every new post still needs a full render the first time someone opens it. Likes go through route handlers that cost five
times what Express pays. And background regeneration and garbage collection block that one thread, so the slowest one
percent of requests breaks first.

## 17. No framework  (~21 s)

So then I went the other way. What if there's no framework at all? Just Express and a template engine. Templates compile
to plain functions, and rendering a page is basically gluing strings together. EJS got 7,900. Nunjucks got 9,700, because
it renders the feed in about half the time. Even your template engine shows up in the numbers.

## 18. Other languages  (~31 s)

And then I tried other languages. Rust hit my cap at 16,000 users while using less than half its CPU, so its real limit
is way higher. ASP.NET did 4,900, which is honestly great. Spring did 2,900, Flask 2,600, Django 1,600. And Laravel
landed right next to Next.js, at 600. That one surprised me, but it makes sense: with PHP-FPM, the whole framework boots
up again for every single request, then it writes a session and encrypts cookies, and only then renders your page.

## 19. Four ways  (~43 s)

So if your SSR is too slow, you've basically got four levers. You can cache, which got Next.js about seven times. You can
switch framework on the same runtime, which got up to nineteen times. You can switch runtime: I ran the exact same Next.js
build on Bun instead of Node, and it went from 500 to 700, so it helps, but not by much. Or you can switch language,
which is where Rust lives. Every one of those has a price, though. Caches go stale, rewrites take time, and your team has
to actually know the new stack. And this test can't see architecture or how readable your code is, which matter a lot in
real projects.

## 20. The answer  (~23 s)

When you line everything up, the pattern is pretty simple. Every layer you put between your data and the HTML costs CPU,
and you pay it on every request. String templates are at the cheap end. Then framework templates. Then components with
hydration data. Then Angular, which builds a whole DOM on the server. And at the very top, Server Components, rendered
twice.

## 21. Takeaways  (~46 s)

So here's what I took away from all this. First, the more abstraction you add, the more CPU every render costs. Second,
your language and framework matter a lot, but JavaScript is totally fine for rendering frontends. Express on Node was the
third best thing I tested. Third, optimize smart. Just asking AI to cache everything got me from 500 to 800. Actually
understanding where the time goes got me to 3,600. Fourth, AI makes rewrites way faster than they used to be, so rewrite
when you actually need to, not because something's trendy. And last, know your tools. Understand the fundamentals and
how your stack works, because that's what lets you make these calls. Thanks for watching, and I'll see you in the next
one.

---

All numbers are from the benchmark: `RESULTS.md`, `report/data.json`. The 0.4 ms cache-hit figure comes from a separate
one-core measurement, not from the load test, which is why it's described that way above.
