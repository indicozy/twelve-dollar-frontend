# remix — React Router 7 framework mode, server-rendered, no caching

Remix's SSR framework was merged into **React Router 7** ("framework mode"). Remix v2 apps upgrade to it, and it
is what the official `create-react-router` template generates. This variant is that template (Tailwind removed),
served by its standard production server `react-router-serve` (`@react-router/serve`, Express 4).

It is the React Router twin of `../nextjs` and `../sveltekit`: same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css` copied verbatim to `app/app.css`). Every page is rendered on every request from a fresh API
call, in one Node process.

Versions (pinned): react-router / @react-router/{node,serve,dev} **7.18.4** (the latest 7.x; 8.x is out, see below),
react / react-dom 19.3.0, vite 8.3.4, typescript 6.0.3, isbot 5.2.2. Express 4.22.3, compression 1.8.2 and
morgan 1.12.1 come in through `@react-router/serve`.

| Piece | File | Notes |
|---|---|---|
| API client (server-only, uncached `fetch`) | `app/lib/api.server.ts` | same functions as the other variants |
| Demo login token + `token` cookie | `app/lib/session.server.ts` | raw JWT cookie, written and parsed by hand (`createCookie` would base64-JSON-wrap it) |
| Like action shared by both pages | `app/lib/like.server.ts` | redirects to `/login` without a token |
| Header (`@username` / Sign in), 404 page | `app/root.tsx` | root `loader` reads the cookie per request; the header sits in `Layout`, so the root `ErrorBoundary` (404s) keeps it |
| Route table | `app/routes.ts` | |
| Feed `/` | `app/routes/home.tsx` | `loader` calls `GET /feed`; `action` handles the compose form (`body`) and the like forms (`id`) |
| Post `/posts/:id` | `app/routes/post.tsx` | throws `data("Not found", { status: 404 })` for missing or invalid ids |
| Login | `app/routes/login.tsx` | `action` signs the demo token, sets the cookie and redirects to `/` |
| JSON passthrough for the load test | `app/routes/api.posts.ts`, `app/routes/api.posts.like.ts` | resource routes (only an `action`), forward `Authorization` |
| Post markup, not-found markup | `app/components/post-card.tsx`, `app/components/not-found.tsx` | |
| Config | `react-router.config.ts` (`ssr: true`, no `prerender`), `vite.config.ts` | |

## How it renders

- **Loaders first, then a streamed render.** For a document request the matched route loaders (root + page) run and
  finish. The framework's default `entry.server` then renders with `renderToPipeableStream` and sends the response
  at `onShellReady`; bots wait for `onAllReady`. The app has no custom entry.server. Nothing is deferred (loaders
  return plain data, no promises), so the shell is the whole page, and status codes are real (404s are 404). The body
  still goes out chunked (`Transfer-Encoding: chunked`, no Content-Length).
- **Hydration payload.** The page embeds its loader data as a **turbo-stream** in an inline script
  (`window.__reactRouterContext.streamController.enqueue(...)`). It also embeds the route manifest and a
  ScrollRestoration script, and adds `<link rel="modulepreload">` for 5 small JS chunks. The browser hydrates the
  whole page, so the post data appears twice: once as HTML and once in the turbo-stream. On `/` that is about
  6.8 KB of inline script in about 18.9 KB of HTML.
- **After hydration**, `<Form>` submissions and `<Link>` navigations fetch `*.data` (turbo-stream) instead of HTML,
  and loaders revalidate automatically after an action. Without JS, the forms post normally. A like re-renders the
  page with fresh loader data (200), login redirects with 302, and the load test only uses the JSON routes anyway.
- **Link prefetching is off**: React Router's `<Link>` defaults to `prefetch="none"`. Links carry a
  `data-discover="true"` attribute (lazy route discovery), and `href` stays literal (`href="/posts/123"`).

## Differences from the Next.js / SvelteKit variants

- **Streaming:** like Next.js, the HTML is streamed through `renderToPipeableStream`. Unlike Next.js there is no
  Suspense fallback or skeleton, because data is loaded before rendering, as in SvelteKit.
- **Payload duplication:** like both others, the data is in the HTML and again in the hydration payload
  (turbo-stream here, the RSC payload in Next.js, devalue in SvelteKit). `/` is about 18.9 KB (SvelteKit about
  16–19 KB, Next.js about 46 KB).
- **No ETag**, no `Cache-Control` on pages. Only `/assets/*` (hashed client files) get
  `Cache-Control: public, max-age=31536000, immutable` from `react-router-serve`'s `express.static`.
- **Compression on by default:** `react-router-serve` mounts `compression()` (gzip), like Next.js and unlike
  SvelteKit's adapter-node. Kept as the default.
- **Request logging on by default:** `react-router-serve` mounts `morgan("tiny")`, so each request writes one line
  to stdout. That is a small per-request cost the other variants don't pay; kept, because it's the default
  server. There is no option to turn it off short of writing a custom server.
- **404 behaviour:** a real 404 status for missing or invalid posts and for unknown paths (Next.js streams and sends
  200 for a missing post). An unmatched URL also logs a `No route matches URL` stack trace to stderr.
- **Origin handling:** form posts (document POSTs and `.data` action requests) are checked against CSRF. A
  present `Origin` must equal the request URL's origin, which is built from the `Host` header, or be listed in
  `allowedActionOrigins`. Over plain http this works with no configuration for `localhost:3000` and
  `127.0.0.1:3000` (unlike SvelteKit, nothing is fixed at build time). A mismatching Origin gets 400. Requests
  without an Origin, like k6's, pass. The JSON resource routes aren't checked at all. Behind a proxy that rewrites
  `Host`, you would need `allowedActionOrigins` in `react-router.config.ts`.
- **One process**, no clustering (`react-router-serve` runs a single Express server).

## Gotchas

- **`NODE_ENV=production` must be set in the environment.** `react-router-serve` sets it itself, but only after
  `react` is already loaded (CJS). That leaves react in development mode against react-dom's production server
  build, and every page then 500s with `dispatcher.getOwner is not a function`. The Dockerfile sets
  `ENV NODE_ENV=production`.
- On Node, `react-router`'s package exports always resolve to its `dist/development` build. This is the package's
  own design; it's the same in every React Router app.
- React Router **8** (8.4.0) is the npm `latest` tag. This variant deliberately uses the 7.x line (7.18.4, released
  the same day). The build prints the v8 future-flag warnings (`v8_middleware`, `v8_splitRouteModules`, …), and all
  of them are left at their v7 defaults.
- `react-router typegen` on Vite 8 prints `The envFile option is deprecated`. It comes from `@react-router/dev`,
  not from this config.

## Build / run

```bash
pnpm install && pnpm build                 # react-router build -> build/client + build/server
pnpm typecheck                             # react-router typegen && tsc
NODE_ENV=production HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 \
  JWT_SECRET=twelve-dollar-challenge pnpm start   # react-router-serve ./build/server/index.js
```

`react-router-serve` listens on `PORT` (if it's unset, it picks a free port starting at 3000) and on `HOST` (if it's
unset, on all interfaces). The Docker image sets `HOST=0.0.0.0 PORT=3000`.

Docker: a multi-stage build like `../sveltekit/Dockerfile` and the official template's Dockerfile. The runtime image
holds `package.json`, `build/` and production `node_modules` (`pnpm install --prod`, 41 MB), plus iproute2 for the
optional `NET_DELAY` (tc netem).
