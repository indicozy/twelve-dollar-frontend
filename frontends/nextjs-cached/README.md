# nextjs-cached — Next.js 16 with runtime-only caching

Same pages, markup and CSS as `../nextjs` (see `../SPEC.md`), but it deliberately breaks the spec's "no caching" rule
so the video can show what caching buys. **Nothing is fetched at build time** (the build works with the API down);
pages and data are cached the first time a request needs them.

| Change | Where | Effect |
|---|---|---|
| `"use cache"` + `cacheLife("content")` + `cacheTag` on `getFeed` / `getPost` | `lib/api.ts`, `next.config.ts` | API results cached in memory at runtime |
| Post pages: placeholder `generateStaticParams` (`"0"`, never fetched) | `app/posts/[id]/page.tsx` | first visit renders the page and stores it; later visits are served from the cache (`x-nextjs-cache: HIT`, ~3–10 ms, ETag) |
| Feed: `connection()` + cached `getFeed()` inside `<Suspense>` | `app/page.tsx` | no build-time data; the API is called once per invalidation, but the feed still renders per request (`/` has no URL param, so Next can't store it as a whole page) |
| Feed entry tagged `feed` **and** `post-<id>` for each of its 20 posts | `lib/api.ts` | liking a post in the feed refreshes the feed too |
| Writes invalidate by tag: `updateTag` in server actions, `revalidateTag(tag, "max")` in route handlers | `app/actions.ts`, `app/api/**` | read-your-own-writes in the UI; stale-while-revalidate for the load test's writes |
| Only new likes (201) invalidate; repeats (200) don't | same | no pointless re-renders |
| Signed-in name moved to a client component reading a `username` cookie | `app/who.tsx`, `app/layout.tsx` | no `cookies()` on the server, so post pages can be stored whole |
| `generateEtags: true` | `next.config.ts` | stored pages carry an ETag; `If-None-Match` → empty `304` |
| `compress: false` | `next.config.ts` | no per-response gzip in Node (a proxy/CDN would do it) |
| Link prefetch back on | `app/post-card.tsx` | prefetching cached pages is cheap |

Checked by hand (single requests, not a benchmark): post page 196 ms first visit → 3–10 ms `HIT` afterwards;
`If-None-Match` → `304` with 0 bytes; after a like the next request is served stale, the one after that shows the
new count; the feed renders in 17–34 ms from cached data.

Each sim run recreates the web container (fresh runtime cache, no stored pages from the previous run's database).
