## 1. Hook (Next.js 500 users vs Hono JSX on Bun 24,100 users)
- why is Next.js {ratio}× slower than Hono on Bun?

## 3. ResultsTable legend
- ~ = estimated from our 30,000-user run

## 9. CacheCosts (Next.js with the best caching only reached 3,600 users)
- so why only 3,600?
- new pages keep breaking the cache
- new posts
- posts happen every second. each new page needs a full render.
- the feed never stays the same
- it goes stale so fast it's constantly being rebuilt

## 11. NoFramework
- plain Express on Node and Bun

## 22. Takeaways (heading, then the line under it)
- string templates 0.17 ms. Server Components 8.4 ms.
- Express + Nunjucks on Bun hit 24,900. JS is plenty fast for rendering.
- AI still can't pick the right architecture
- optimize first. don't switch frameworks unless you have to.
## 7. SearchPath (a chart of test runs: user count doubles until a 2-minute run fails, then a binary search narrows the gap, then 5-minute runs confirm; ends on Express's real score)
- how i tested Express: double, halve, then hold
- the range between last pass and first fail
- double until it breaks
- narrowing the gap
- 5-minute soak tests
