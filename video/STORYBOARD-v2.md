# Storyboard v2: "Why is JS, and especially React + Next.js, so slow?"

Same look and data as v1 (`STORYBOARD.md`), restructured around one question and told in the order the
investigation actually happened. Composition: `FullV2` → `out/full-v2.mp4`. v1 (`Full`, `FullGemma`) is unchanged.

## Story

Show every result first. Ask why Next.js is at the bottom. Then follow the investigation step by step (each step
carries a small "step N of 7" chip), land on the answer (abstraction costs CPU), and close with five takeaways.

## Shots

| # | Shot | ~s | Step chip | What it shows |
|---|---|---:|---|---|
| 1 | Hook | 9 | | Next.js 500 vs Express + Nunjucks 9,700, "19×" |
| 2 | Scope | 11 | | only server-side rendering is tested |
| 3 | ResultsTable | 16 | | all 21 stacks: users, CPU per request, peak memory; Next.js row highlighted |
| 4 | BigQuestion | 6 | | "but why is Next.js so slow???" |
| 5 | Setup | 10 | 1 · measure it properly | k6 → frontend server → API |
| 6 | OneUser | 10 | 1 · measure it properly | the k6 user loop |
| 7 | PassFail | 10 | 1 · measure it properly | thresholds and the 5-minute hold |
| 8 | SearchPath | 10 | 1 · measure it properly | Express's real search path |
| 9 | NotRam | 8 | 2 · is it RAM? | CPU full, memory mostly unused |
| 10 | CpuPerRequest | 12 | 3 · where does the CPU go? | CPU per request, Next.js on top |
| 11 | Pipeline | 12 | 3 · where does the CPU go? | Next.js renders twice and inlines the tree; Remix once |
| 12 | ReactFamily | 10 | 4 · is it React? | Remix and TanStack Start: about 5× Next.js |
| 13 | Caching | 12 | 5 · just cache everything? | 500 → 800 → 3,500 → 3,600, Express as the line |
| 14 | CacheCosts | 12 | 5 · just cache everything? | why caching stops there |
| 15 | NoFramework | 11 | 6 · what if no framework? | Express + EJS / Nunjucks |
| 16 | OtherLangs | 11 | 7 · what about other languages? | Laravel … Rust |
| 17 | AbstractionLadder | 14 | | the answer: each layer of abstraction adds CPU per page |
| 18 | TakeawaysV2 | 18 | | the five takeaways |

## Takeaways (on screen)

1. more abstraction → more CPU per render
2. language matters most, but JS is fine for frontend rendering
3. optimize smart: asking AI to "cache everything" never works
4. understand the fundamentals: how your language and tools actually work
5. AI makes rewrites fast; rewrite when it's actually needed
