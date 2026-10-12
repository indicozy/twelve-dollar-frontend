# nextjs-nginx-cache: Next.js 16 behind an nginx microcache (caching outside the framework)

The unmodified `../nextjs` app (same build, standalone server on Node 24) with **nginx in front of it in the same
container**, like `../laravel` puts nginx and php-fpm in one container. It deliberately breaks the spec's "no caching"
rule to show an architecture lever: the framework renders every request it sees, and a reverse proxy serves most
anonymous page views from a 1-5 s cache. Nothing in the app changes (only the header label, `next.js · nginx cache`).

| | |
|---|---|
| Versions | Next.js 16.4.0, React 19.3.0, Node 24 (`node:24-bookworm-slim`), nginx 1.22.1 (Debian `nginx-light=1.22.1-9+deb12u10`) |
| Processes | `node server.js` on 127.0.0.1:3001 (background job; the container stops if it exits) and nginx as PID 1 on :3000, **1 worker** (`docker/entrypoint.sh`) |
| Cached | `GET /` 1 s, `GET /posts/<id>` 5 s, status 200 only (`proxy_cache_valid`), memory-backed keys zone + files in `/var/cache/nginx/micro` |
| Stampede control | `proxy_cache_lock on` (one request fills an entry), `proxy_cache_use_stale updating` + `proxy_cache_background_update on` (expired entries are served once more while one background request refreshes them) |
| Key | method, host, path, normalised `Accept-Encoding` (gzip or none; Next.js compresses) |
| Not cached | POSTs (server actions, forms), `/api/*`, `/login`, `/_next/*`, any URL with a query string, and any request with the `token` cookie, an `RSC` / `Next-Router-*` / `Next-Action` header or `Authorization`; responses with `Set-Cookie` are never stored |
| Ignored upstream headers | `Cache-Control` (Next.js sends `private, no-store` for dynamic pages), `Expires`, `Vary`, `X-Accel-*`: every `Vary` dimension except `Accept-Encoding` is a bypass, and that one is in the key |
| Debug | `X-Cache: HIT / MISS / BYPASS / STALE / UPDATING` on the cached locations |

**Signed-in users are never cached**: their pages show `@username` and the like/compose forms. RSC requests (client
navigation and prefetch, `RSC: 1` header or `?_rsc=`) bypass the cache, so they never get cached HTML.

**What the load test sees.** `bench/ssr-load.js` sends page GETs with no cookie (its token goes only in the
`Authorization` header of the `/api` POSTs, and nothing sets a `token` cookie), so every feed and post-page request is
anonymous and cacheable. The result is therefore "anonymous traffic behind a microcache", not plain Next.js: the feed
is at most ~1 s stale, a post page at most ~5 s (plus one stale hit during refresh). Writes go straight through.

Keep-alive: nginx keeps idle client connections 5 s (Node's default, like the plain variant) and a pool of up to 64
upstream connections to Node, closed after 4 s idle (below Node's 5 s, so nginx never reuses a closing socket).

Like `../nextjs`, an unknown post returns the not-found page with status 200 (streamed shell), so it is cached for
5 s too.
