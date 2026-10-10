You're rewriting the on-screen captions for a YouTube video. The current text sounds like it was written by an AI. I want it to sound like a developer who ran the experiment and is explaining it to other developers: casual, direct, a bit opinionated, never corporate.

## What the video is about

I benchmarked 21 ways to build the same small website (a Twitter-like feed) to see how many users one cheap server can handle. Same site, same backend API, same tiny server (0.4 of a CPU, 2 GB RAM); only the frontend framework changes. The results range from 500 users (Next.js) to 9,700 (plain Express with Nunjucks templates). The video explains why: some frameworks spend far more CPU turning data into HTML than others. It only covers rendering on the server, not how fast pages feel in the browser.

The audience is web developers. They know what Next.js, React, SSR, hydration, CPU and p99 latency are, so don't explain basics.

## The text

Below is every piece of on-screen text, grouped by shot (one heading per shot). These are captions and labels on animated slides, not narration: they sit next to charts and diagrams.

[PASTE THE CONTENTS OF COPY.md HERE]

## How to rewrite it

Voice:
- Write like a person talking, not a press release. Short, plain words. Contractions are fine.
- Lowercase-casual is fine for headings (the video's style is a hand-drawn whiteboard), e.g. "so why is Next.js this slow?".
- A little personality is welcome ("yeah, that's not a typo"), but at most once or twice in the whole video. Don't force jokes.

Avoid these, they're what makes it sound AI-written:
- Em dashes and "X: Y" reveal sentences ("the reason: CPU"). Use a full stop or just say it.
- "Not X, but Y" / "it's not about X, it's about Y" framing.
- Words like: delve, crucial, leverage, robust, seamless, landscape, unlock, game-changer, under the hood, it's worth noting, in fact, notably, essentially, ultimately.
- Triplets for rhythm ("fast, simple, and reliable") and dramatic one-word sentences.
- Rhetorical questions stacked on top of each other.
- Hedging ("arguably", "it could be said").

Keep exactly:
- Anything in {braces}. Those are numbers filled in from the data when the video renders. You can move them within the line or reword around them, but don't drop or rename them.
- Technical facts and numbers: 0.4 vCPU, 2 GB, p95 < 500 ms, p99 < 1 s, errors < 1%, 5-minute hold, 0.09 page requests per second per user, 0.40 ms, 0.56 ms vs 0.11 ms, ~28 KB, ~7 KB, 39 KB vs 12 KB, 0.17 ms vs 0.08 ms, 16,000-user cap, 45% CPU, 21 stacks. Don't round, change or add numbers.
- Product names, spelled exactly: Next.js, Remix (React Router 7), TanStack Start, SvelteKit, SolidStart, Nuxt, Qwik, Angular, Astro, Express, EJS, Nunjucks, Flask, Django, Laravel, Spring Boot, ASP.NET, Rust, k6, SQLite.
- The meaning of each line. If a line is a diagram label (like "fetch data", "render HTML", "1 API call"), keep it short and literal: labels should stay labels.

Length:
- Each rewritten line must be about the same length as the original or shorter, since it has to fit on the slide. Headings: under 40 characters. Labels: under 30. Longer captions: under 90.

## Output

Return the same Markdown structure: the same "## N. ShotName" headings in the same order, one "- " bullet per line, the same number of bullets per shot, in the same order, so I can match each new line to the old one. No commentary, no explanations, no extra lines.
