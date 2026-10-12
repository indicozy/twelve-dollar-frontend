# laravel-octane: Laravel 13 + Blade on Laravel Octane (FrankenPHP worker mode), no caching

The same app as `../laravel` (routes, controllers, Blade views, `web` middleware with file sessions and encrypted
cookies, CSRF, Laravel's `Http` client, `/api/*` passthrough, 404 page), copied file for file. **Only the execution
model changes**: instead of nginx + PHP-FPM booting Laravel for every request, **Laravel Octane** boots the framework
once per worker and keeps it in memory, serving requests from **FrankenPHP** (a Go/Caddy web server with PHP embedded)
in worker mode. Comparing the two isolates what Laravel's per-request boot costs. Pages ship zero JS.

Why FrankenPHP: it is Octane's recommended server, the official image is pinned to the same PHP 8.5.11 on Debian trixie
as `../laravel`, and it needs only `pcntl` (bundled with PHP) on top. It worked first try, so Swoole/RoadRunner were
not needed.

| | |
|---|---|
| Versions | PHP **8.5.11 ZTS** (`dunglas/frankenphp:1.13.1-php8.5.11-trixie`; FPM used the NTS build), FrankenPHP **1.13.1**, Caddy **2.11.7**, Laravel Octane **2.21.0** (+ `laminas/laminas-diactoros` 3.9.0, `symfony/psr-http-message-bridge` 8.1.0), Laravel framework 13.35.0, Guzzle 8.2.0, Composer 2.10.3. All other `composer.lock` entries are identical to `../laravel`. |
| Server | `php artisan octane:frankenphp` (Octane's standard production command; a small PHP supervisor process) runs `frankenphp run` with `docker/frankenphp/Caddyfile` |
| Workers | `OCTANE_WORKERS=2` (see "Worker count"); FrankenPHP `num_threads` = workers + 1 |
| Worker recycling | `--max-requests=500` (Octane's default): a worker re-boots Laravel after 500 requests |
| Feed page | 12,636 bytes, byte-identical markup to `../laravel` (apart from the per-session `_token` values) |

## Changes from `../laravel`

| File | Change |
|---|---|
| `composer.json` / `composer.lock` | `+ laravel/octane` (2.21.0) and its two PSR-7 deps; name/description |
| `config/octane.php` | Octane's default config, unchanged (what `octane:install` publishes); `OCTANE_SERVER=frankenphp` |
| `public/frankenphp-worker.php` | Octane's worker stub (what `octane:install` publishes) |
| `docker/frankenphp/Caddyfile` | Octane's stock Caddyfile minus `encode zstd br gzip` (nginx had gzip off) and with explicit `num_threads` |
| `docker/entrypoint.sh` | `config:cache`, then `exec php artisan octane:frankenphp --host=0.0.0.0 --port=3000 --workers=$OCTANE_WORKERS ...` |
| `Dockerfile` | FrankenPHP image instead of php-fpm + nginx; `docker-php-ext-install pcntl` (Octane's supervisor needs it for signals); NET_DELAY line in `CMD` |
| removed | `docker/nginx/`, `docker/php-fpm/` |

No app code changed: the app has no static/singleton state (`FeedApi` and `DemoToken` are static helpers that read
config and the current request), so it is Octane-safe as is. Verified: after logging in as `@alice` on one cookie jar,
cookie-less requests to both workers never show `@alice`.

## How a request flows

1. **FrankenPHP** (Caddy, Go) accepts the connection (keep-alive). `styles.css` and other files in `public/` are served
   by Caddy's file server; everything else goes to `frankenphp-worker.php`.
2. A **worker thread** that has already booted Laravel (autoloader, container, providers, config/routes/views from
   the caches) receives the request via `frankenphp_handle_request()`. Octane clones a fresh sandbox of the app,
   runs the request through the HTTP kernel (same global middleware and `web` group as `../laravel`), then flushes
   per-request state (auth, session, cookies, view shares, etc., per `config/octane.php` listeners).
3. The controller calls the API with the same Laravel **Http client**. Laravel builds a new Guzzle client per request,
   so this still **opens a new TCP connection to the API per request**, as in `../laravel` (kept on purpose: only the
   execution model is changed).
4. Blade renders from the compiled views; the session is still written to a file and the session/XSRF cookies are
   still encrypted on every response.

What persists between requests (the point of Octane): the booted application, resolved singletons and service
providers, PHP's class table. OPcache stays on (same `zz-production.ini`), but with the code already loaded in each
worker it matters only for boots/re-boots.

## Sessions and CSRF (the price of Laravel's defaults)

The pages have HTML forms with `@csrf`, Laravel's default protection, which keeps the token in the session. So the
default `web` middleware group is kept: **every page view starts a session**. The skeleton's default session driver is
`database`; with no database here, this uses the **`file` driver**, Laravel's long-time default and the usual choice
for a single server without Redis.

The cost, per page view:

- a session file read (if the request has a session cookie) and **a session file write, always**, in
  `storage/framework/sessions` (inside the container's filesystem), unchanged under Octane;
- two encrypted cookies set on every response (`laravel-session` and `XSRF-TOKEN`, AES-256-CBC + HMAC, ~330 bytes
  each), and the session cookie decrypted on the way in;
- a new session (a new file) for every request that arrives without a cookie. The load test's k6 VUs keep their
  cookies within an iteration, so each iteration's feed page creates one file and the post page reuses it. Files expire
  after `SESSION_LIFETIME` (120 min); the garbage collector runs on 2% of requests and scans the directory.
  140 cookie-less requests in a quick test left 137 files;
- `@csrf` adds a hidden `_token` input to every form: 21 on the feed page, about 1.7 KB of HTML.

The `cookie` driver would avoid the disk write but encrypts the whole session into a cookie instead; the
`array` driver would break CSRF. Laravel 13's `PreventRequestForgery` middleware also accepts a request whose
`Sec-Fetch-Site` is `same-origin` without a token, so browsers pass even without the token; curl/k6 need the token.
The 404 page for unknown paths runs no route middleware, so it sets no cookies. The JSON routes (`/api/*`) use the
`api` group: no session, no CSRF, no cookies.

The `token` cookie holds the raw JWT, like the other variants (`encryptCookies(except: ['token'])`), so the header
can read the username from the JWT payload and the same cookie works with the seed tokens. It is a browser-session
cookie (`httpOnly`, `SameSite=Lax`, not `Secure`), as in SvelteKit.

## Worker count

Octane's `--workers=auto` means "FrankenPHP's default", which sizes by the CPUs the process sees: the host's cores,
not the container's `--cpus 0.4`. So the count is explicit (`OCTANE_WORKERS`, default 2). FrankenPHP needs more threads
than workers; `num_threads` is set to workers + 1 (its default would also be host-sized).

Measured on the 0.4-CPU box (`--cpus 0.4 -m 2g`, `bench/ssr-load.js`, 60 s + 20 s ramp, all 0% errors; container
cgroup CPU / k6 request count, which includes the ~17 ms/s idle cost of the healthcheck and supervisor):

| | VUs | req/s | CPU ms/req | median | p95 |
|---|---|---|---|---|---|
| Octane, 1 worker | 300 | 24.6 | 5.91 | 4 ms | 14 ms |
| Octane, 2 workers | 300 | 24.3 | 5.33 | 4 ms | 12 ms |
| Octane, 1 worker (2 runs) | 1200 (saturated) | 95.1 / 80.4 | 3.38 / 4.18 | 90 / 1912 ms | 1.58 / 4.63 s |
| Octane, 2 workers (2 runs) | 1200 (saturated) | 79.0 / 86.3 | 4.10 / 3.99 | 2318 / 1220 ms | 6.02 / 2.95 s |
| `../laravel` (FPM, 10 workers) | 300 | 24.9 | 6.06 | 5 ms | 12 ms |
| `../laravel` (FPM, 10 workers) | 1200 (saturated) | 32.8 | 12.15 | 18.5 s | 26.5 s |

1 and 2 workers are within run-to-run noise (other builds were running on the host). 2 is the default because a
request that waits on the API (or a slow API response) then doesn't stall every other request; the CPU cost is the
same. Under saturation Octane serves ~2.5-3x the requests of FPM at about a third of the CPU per request: FPM's cost
per request doubles under load (10 processes re-booting Laravel and fighting over 0.4 CPU), Octane's stays at ~4 ms.

Memory (idle after load): ~145 MB for the container (FrankenPHP + 2 booted workers + supervisor) vs ~89 MB for
`../laravel`.

## Differences from `../laravel` you can see from outside

- `Server: FrankenPHP Caddy` instead of `Server: nginx/1.26.3`. The post page (1.1 KB) is sent with
  `Content-Length`, the feed (12.6 KB) chunked (nginx chunked both). No compression in either.
- Redirect `Location`s keep the port of the `Host` header (`http://127.0.0.1:3104/`); behind nginx Laravel saw
  `SERVER_PORT` 3000 / no port (`http://127.0.0.1/`). Relative behaviour is the same.
- Caddy's admin API listens on `localhost:2019` inside the container (not published).

## Environment

| Env | Default | |
|---|---|---|
| `BACKEND_URL` | `http://127.0.0.1:4000` | read by `config:cache` at container start |
| `JWT_SECRET` | `twelve-dollar-challenge` | signs `/login` tokens |
| `APP_KEY` | a benchmark-only key in the `Dockerfile` | encrypts the session and XSRF cookies |
| `OCTANE_WORKERS` | `2` | Laravel workers (FrankenPHP worker threads) |
| `OCTANE_MAX_REQUESTS` | `500` | requests before a worker re-boots (Octane's default) |
| `FRANKENPHP_NUM_THREADS` | workers + 1 | |
| `APP_ENV` / `APP_DEBUG` | `production` / `false` | |
| `LOG_CHANNEL` | `stderr` | |
| `NET_DELAY` | empty | optional `tc netem` delay, as in the other variants |

FrankenPHP listens on port 3000 inside the container (`EXPOSE 3000`).

## Build and run

```bash
docker build -t perf-laravel-octane .
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:4000 perf-laravel-octane
# in sim/: FRONTEND=laravel-octane ./sim.sh ...
```
