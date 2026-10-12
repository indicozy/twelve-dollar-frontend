# laravel-tuned: Laravel 13 + Blade on Octane (FrankenPHP), with production tuning, no caching

`../laravel-octane` (same routes, controllers, Blade markup, `web` middleware with sessions, encrypted cookies and
token CSRF on every form, Laravel's `Http` client, `/api/*` passthrough, 404 page) plus the tuning a Laravel team
would apply in production. Still **no HTML or data caching**: every page is rendered from a fresh API call.
Why and how much each change saves: `research/anomalies-laravel.md`.

| | |
|---|---|
| Versions | Same as `../laravel-octane`: PHP **8.5.11 ZTS** (`dunglas/frankenphp:1.13.1-php8.5.11-trixie`), FrankenPHP 1.13.1, Caddy 2.11.7, Laravel framework 13.35.0, Laravel Octane 2.21.0, Guzzle 8.2.0, Composer 2.10.3 (`composer.json` / `composer.lock` unchanged) |
| Server | `php artisan octane:frankenphp`, 2 workers, `--max-requests=500` (unchanged) |
| Feed page | 12.6 KB, same markup as `../laravel-octane` (apart from the per-session `_token` values) |

## Changes from `../laravel-octane`

| File | Change | Why |
|---|---|---|
| `app/Support/FeedApi.php` | `Http::...->setHandler($handler)` with one Guzzle `CurlHandler` per worker, kept for the worker's lifetime | Laravel's `Http` client builds a new Guzzle handler per call, so each page opened a new TCP connection to the API (plus a DNS lookup of `api`). The reused handler keeps its cURL handles and with them a keep-alive connection. The `PendingRequest`, Guzzle client and cookie jar are still built per call, so no request state is shared. |
| `Dockerfile` | `SESSION_DRIVER=cookie` (was `file`) | The file driver wrote a session file per page view (a new one for every cookie-less visitor) and swept the directory on 2% of requests. The cookie driver keeps the (small) session in an encrypted cookie: no disk I/O, no sweeping. |
| `app/Http/Middleware/PreventRequestForgery.php`, `bootstrap/app.php` | Laravel's CSRF middleware with `$addHttpCookie = false` | Still checks the `_token` of every POST form (419 without it). Only drops the `XSRF-TOKEN` cookie, which exists for JS clients (Axios) and was encrypted and sent on every response; these pages have no JS. |
| `config/octane.php` | `RequestReceived` listeners listed explicitly: Octane's defaults minus those for services the app doesn't use (database, queue, mail, notifications, broadcasting, gates, validation, filesystem, paginator, Vite, Inertia/Livewire/Scout/Socialite) | Octane resolves each listener from the container and calls it on every request, whether or not the service exists. |
| `config/view.php` (new) | `check_cache_timestamps => false` | Views are compiled into the image (`view:cache`) and never change, but Blade stat()ed each view's source and compiled file on every render (Octane resets the view engine per request, so its "already checked" memo doesn't help). |
| `resources/views/partials/post-card.blade.php` | The post card is an `@include` partial instead of the `<x-post-card>` anonymous component (`feed`, `post` views) | 20 cards per feed page; a component pays for props/attribute bags and the component stack each time. Same markup. |
| `docker/php/zz-production.ini` | `opcache.jit=tracing`, `opcache.jit_buffer_size=64M` | The JIT is off by default in PHP 8.5; the long-lived workers run the same framework code all day. |

Kept as in `../laravel-octane` (already production-grade or measured as no gain): `config:cache` (entrypoint),
`route:cache`, `view:cache`, `event:cache` (build), `composer dump-autoload --optimize`, OPcache with
`validate_timestamps=0`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr` (nothing is logged per request), Caddy log level
WARN, 2 workers, `max_requests` 500 (10,000 made no measurable difference), the global middleware stack
(dropping CORS/TrustProxies/maintenance-mode middleware saved ~4% but they have an operational purpose), the
`EncryptCookies` middleware for the session cookie, and token CSRF on every form.

## Sessions and CSRF

Every page has POST forms with `@csrf`, so every page view still starts a session and sets the session cookie, as in
`../laravel-octane`. With the cookie driver the session lives in the browser: the response sets the session-ID cookie
and an encrypted cookie holding the session data (CSRF token, previous URL, flashed errors), instead of the session
cookie, the `XSRF-TOKEN` cookie and a file on disk. The `Set-Cookie` lines are 456 + 799 bytes (octane: 441 + 456),
so responses are ~350 bytes larger; the HTML is byte-identical to `../laravel-octane` (`/`, `/posts/1`, 404,
`/login`, apart from the `_token` values). Flashing the compose form's API
error (`->with('error', ...)`) works as before.

What the session + token CSRF still costs: replacing them with Laravel 13's origin-only CSRF
(`preventRequestForgery(originOnly: true)`, which checks `Sec-Fetch-Site` like the other variants' Origin check)
and no session on the pages saved about 19% instructions per request in a test. Not applied: it changes the
security model (and the markup: no `_token` fields).

## Environment, build and run

Same as `../laravel-octane` (`BACKEND_URL`, `JWT_SECRET`, `APP_KEY`, `OCTANE_WORKERS`, `OCTANE_MAX_REQUESTS`,
`NET_DELAY`), except `SESSION_DRIVER` defaults to `cookie`.

```bash
docker build -t perf-laravel-tuned .
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:4000 perf-laravel-tuned
# in sim/: FRONTEND=laravel-tuned ./sim.sh ...
```
