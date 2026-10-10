# solidstart — SolidStart 2 (Solid 1.9), server-rendered, no caching

The SolidStart twin of `../nextjs` and `../sveltekit`: same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css` copied verbatim to `src/styles.css`), every page rendered on every request from a fresh API
call, one Node process (Nitro `node_server` preset: `node .output/server/index.mjs`).

Versions (pinned): `@solidjs/start` 2.0.6, `@solidjs/router` 1.0.0, `solid-js` 1.9.17, `vite` 8.3.4,
`nitro` 3.0.260903-beta (the Nitro version SolidStart 2's templates use; Nitro 3 is only published as beta),
`typescript` 7.0.2, Node 24.

| Piece | File | Notes |
|---|---|---|
| Vite config | `vite.config.ts` | `solidStart()` + `nitro({ preset: "node_server" })` |
| Document, render mode | `src/entry-server.tsx` | `createHandler` with no options: default `mode: "stream"` |
| Layout (header, signed-in name) | `src/app.tsx` | `createAsync(getUsername)` reads the `token` cookie on the server per request |
| API client (server-only, uncached `fetch`) | `src/lib/api.ts` | same functions as the Next.js variant |
| Demo login token + cookie reading | `src/lib/session.ts` | same HS256 payload as the other variants |
| Data loading | `src/lib/queries.ts` | `query()` + `"use server"`: runs in-process during SSR |
| Mutations | `src/lib/actions.ts` | `action()` + `"use server"`: create, like, login |
| Post markup | `src/lib/PostCard.tsx` | `<form action={likeAction} method="post">` |
| Feed `/` | `src/routes/index.tsx` | compose form (`useSubmission` for error/pending) + 20 posts |
| Post `/posts/:id` | `src/routes/posts/[id].tsx` | real **404** (`HttpStatusCode`) for missing or invalid ids |
| Login | `src/routes/login.tsx` | |
| Not found | `src/routes/[...404].tsx`, `src/lib/NotFound.tsx` | 404 status |
| JSON pass-through for the load test | `src/routes/api/posts/index.ts`, `src/routes/api/posts/[id]/like.ts` | forwards `Authorization` as-is |

## How it renders

- **Streaming (the framework default, kept).** SolidStart renders with `renderToStream`. The shell (head, header,
  nav) is flushed first; if the route's data isn't there yet, the feed arrives later in the same response as a
  `<template>` plus a small script that swaps it in (like Next.js with `<Suspense>`). With a fast local API the feed
  usually resolves before the shell flushes, so it is inlined. Either way all 20 posts are in the HTML response.
- **Post page waits for its data** (`createAsync(..., { deferStream: true })`): the response status is fixed when
  the shell is flushed, so without this a missing post got 404 or 200 depending on timing. With it, the status is
  always right (404 for `/posts/999999999` and `/posts/abc`). The feed page streams as described above.
- **Hydration payload.** Solid adds `data-hk` attributes to component root elements and `<!--$-->…<!--/-->` text
  markers, and serializes every `query` result (the 20 feed posts, or the post, and the username) into inline
  `<script>` tags (`_$HY.r["feed[]"]=…`, about 5 KB on the feed page). The opening tag looks like
  `<article data-hk="00000001000300000400" class="post" data-post-id="500000">`, so `href="/posts/<id>"` and
  `data-post-id="<id>"` stay literal. Client JS is about 90 KB uncompressed (all modulepreloaded).
- **No caching across requests.** On the server, `query` keeps its dedupe cache on the request event, so it only
  dedupes within one render. Nothing is prerendered. After an action the router revalidates the page's queries
  (with JS), or the no-JS form post is redirected (302) back to the page, which renders fresh data.

## Differences from the Next.js / SvelteKit variants

- **Size.** Feed page about 18.7–19.1 KB (inlined vs streamed), post page about 3.2 KB. SvelteKit: 16–19 KB,
  Next.js: about 46 KB.
- **ETag.** None on pages (SvelteKit sends one; Next.js doesn't for dynamic pages). Static assets under
  `/_build/assets/` get an ETag and `cache-control: public, max-age=31536000, immutable`.
- **Compression.** None. Nitro's node server doesn't gzip dynamic responses (same as SvelteKit; Next.js gzips by
  default). Pages go out as `Transfer-Encoding: chunked`, `content-type: text/html`, no `cache-control`.
- **404s.** Real 404 status for unknown paths and for missing/invalid post ids (SvelteKit: same; Next.js streams
  and answers 200 for missing posts).
- **Origin handling.** Nothing to configure. Server functions (form posts to `/_server?id=…`) are refused with 403
  when cross-site: SolidStart trusts `Sec-Fetch-Site`, else compares `Origin` with the request's `Host`. So forms
  work over plain http on any host, including `localhost:3000` and `127.0.0.1:3000` (SvelteKit needs a build-time
  origin). API routes aren't checked, so the load test's JSON writes go through.
- **No-JS form errors.** The compose error ("body is required") survives the no-JS redirect through a `flash`
  cookie that SolidStart marks `Secure`; browsers keep it on `http://localhost` but not on other plain-http hosts.
  With JS (the normal case) the error comes back in the action response.
- **CSS.** SolidStart's production CSS bundle also contains its dev-toolbar styles (statically imported by its
  `ErrorBoundary`), so the stylesheet is about 20 KB instead of 3.8 KB. It is a cached static asset and doesn't
  affect page render cost.

## Build and run

```bash
pnpm install && pnpm build
BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
pnpm check   # tsc --noEmit
```

`BACKEND_URL` and `JWT_SECRET` are read from `process.env` at runtime (not inlined at build). The Docker image
copies only `.output/` (Nitro bundles every dependency into it).
