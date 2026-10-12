## 1. Hook (Next.js 500 users vs Hono JSX on Bun 24,100 users)
- [question at the bottom] why is Next.js {ratio}× slower than Hono on Bun?

## 3. ResultsTable legend
- ~ = estimated from our 30,000-user run

## 9. CacheCosts (Next.js with the best caching only reached 3,600 users)
- [heading] so why only 3,600?
- [subheading] a social network keeps making new pages, so the cache keeps missing
- [card title] new posts
- [card body] people post every second, and each new post page is a full render on its first view
- [card title] a feed that never sits still
- [card body] the feed goes stale in seconds, so it gets rebuilt over and over

## 11. NoFramework
- [subheading] plain Express, on Node and on Bun

## 22. Takeaways (heading, then the line under it)
- [line 1 detail] string templates 0.17 ms. Server Components 8.4 ms.
- [line 2 detail] Express + Nunjucks on Bun held 24,900. JS is fine for frontend rendering.
- [line 3 detail] AI still can't make architecture decisions
- [line 4 detail] optimize first. only make drastic changes when there's no other option
