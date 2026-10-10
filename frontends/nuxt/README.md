# nuxt — Nuxt 4 (Vue 3), server-rendered, no caching

The Nuxt twin of `../nextjs` and `../sveltekit`: same pages, markup and CSS (`../SPEC.md`, `../shared/styles.css`),
every page rendered on every request from a fresh API call, one Node process (Nitro's default `node-server` preset:
`node .output/server/index.mjs`). No `routeRules`, no prerendering, no SWR/ISR.

Versions: nuxt 4.6.0, vue 3.5.43, vue-router 5.4.0, nitropack 2.13.4 (h3 1.15.11), vite 8.3 + rolldown 1.2.13,
typescript 6.0.3, vue-tsc 3.3.12. Nuxt 4.6 asks for Node `^24.11`; the Docker image (`node:24-bookworm-slim`) has it.

| Piece | File | Notes |
|---|---|---|
| API client (server-only, uncached `fetch`) | `server/utils/api.ts` | same functions as the other variants |
| Demo login token | `server/utils/session.ts` | same HS256 payload as the other variants |
| Signed-in name in the header | `app/plugins/session.server.ts`, `app/components/AppHeader.vue` | reads the `token` cookie per request on the server; reaches the client through `useState` (the cookie is httpOnly) |
| Feed `/` | `app/pages/index.vue` (+ `ComposeForm.vue`, `PostCard.vue`) | `await useFetch('/api/feed')` during SSR |
| Post `/posts/:id` | `app/pages/posts/[id].vue` | real **404** for missing or invalid ids |
| Read endpoints behind `useFetch` | `server/api/feed.get.ts`, `server/api/posts/[id].get.ts` | |
| Like / create forms | `server/routes/actions/{like,create}.post.ts`, `app/composables/useFormAction.ts` | see Mutations |
| Login | `app/pages/login.vue`, `server/routes/login.post.ts` | the form posts to its own URL |
| Not found | `app/error.vue` | keeps the header, like SvelteKit's `+error.svelte` |
| JSON pass-through for the load test | `server/api/posts/index.post.ts`, `server/api/posts/[id]/like.post.ts` | forwards `Authorization` |

## How it renders

`useFetch('/api/feed')` runs during SSR. On the server Nuxt does not open an HTTP connection to itself: it calls the
Nitro handler in-process (`localFetch`), and that handler calls `fetch(BACKEND_URL + '/feed')`. The page is rendered
with Vue's `renderToString` and sent in one piece. After hydration (`refreshNuxtData()`, client-side navigation) the
browser calls the same `/api/...` endpoints over HTTP, much like SvelteKit's `__data.json`.

## Mutations

Nuxt has no form actions or server actions, so mutations go through server routes plus a plain HTML form:

- Without JS, the like and compose forms POST to `/actions/like` and `/actions/create`. The server forwards the
  `token` cookie as `Authorization: Bearer …` and answers `303`: back to the posting page (same-origin `Referer`),
  to `/login` when signed out, or to `/?error=…` when a post is rejected.
- With JS, `useFormAction` posts the same form with `$fetch` (`Accept: application/json`) and calls
  `refreshNuxtData()` to show the new count. This plays the part of SvelteKit's `use:enhance` and Next.js's
  `useActionState`.

## Differences from the Next.js and SvelteKit variants

- **No streaming.** Like SvelteKit, the whole page is rendered and then sent with a `Content-Length` (no chunked
  encoding, no skeleton). The feed page is about **15.4 KB** (SvelteKit about 16–19 KB, Next.js about 46 KB). The post
  page is about **2.1 KB**, and the 404 page about 1.5 KB.
- **Payload duplication.** The `useFetch` data is embedded once for hydration, as `devalue` JSON in
  `<script id="__NUXT_DATA__">` (about 4.2 KB for the 20-post feed; repeated strings are deduplicated). The browser
  then runs the page's components to take over.
- **No ETag** on rendered pages and no `cache-control` header. Only the hashed `/_nuxt/*` assets get an ETag and
  `cache-control: public, max-age=31536000, immutable`. SvelteKit sends an ETag on pages.
- **No compression.** Nitro's node server does not gzip dynamic responses (Next.js does by default).
- **`x-powered-by: Nuxt`** header is sent (framework default; the Next.js variant turns its equivalent off).
- **404s are real.** A missing post (`/posts/999999999`), an invalid id (`/posts/abc`, where the API answers 400) and
  an unknown path all give status 404. A browser (`Accept: text/html`) gets `error.vue`. A client that does not
  accept HTML (for example bare `curl`) gets Nitro's JSON error body (`{"error":true,"statusCode":404,…}`). Each 404
  also logs a `[request error]` line with a stack trace.
- **Origin handling.** Nuxt/Nitro has **no CSRF or origin check**, so nothing has to be set at build time (unlike
  SvelteKit's build-time `ORIGIN`). The form endpoints (`/login`, `/actions/*`) apply the same check as Next.js server
  actions: an `Origin` header must match the request's `Host`, or the request gets a 403. Forms therefore work over
  plain http on `localhost:3000`, `127.0.0.1:3000` or the sim's IP. The JSON routes under `/api` are not checked.
  The token cookie is `SameSite=Lax`.

## Build and run

```bash
pnpm install && pnpm build          # pnpm typecheck for vue-tsc
BACKEND_URL=http://127.0.0.1:4000 HOST=127.0.0.1 PORT=3000 node .output/server/index.mjs
```

`.output/` is self-contained: Nitro bundles the server and traces its few runtime packages into
`.output/server/node_modules`. That is all the Docker runtime stage copies. Env: `BACKEND_URL` (default
`http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT` (Nitro also reads
`NITRO_HOST`/`NITRO_PORT`). The Dockerfile sets `0.0.0.0:3000`.
