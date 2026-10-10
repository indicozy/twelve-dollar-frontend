# laravel: Laravel 13 + Blade on PHP-FPM behind nginx, no caching

The PHP version of `../sveltekit` and `../astro`. It has the same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page is rendered on every request from a fresh API call. It is served the standard
production way for PHP: **nginx and PHP-FPM in one container**, nginx talking FastCGI to a fixed pool of 10 FPM
workers over a Unix socket, with OPcache on and Laravel's production caches. Pages ship **zero JS**.

Versions: PHP **8.5.11** (`php:8.5.11-fpm-trixie`), Laravel framework **13.35.0** (skeleton `laravel/laravel`
13.11.0; Laravel 13 needs PHP ^8.3 and supports 8.5), Guzzle 8.2.0 (under Laravel's Http client), Symfony 8.1
components, nginx **1.26.3** (Debian trixie's apt package), Composer 2.10.3 (`composer:2.10.3`, which also runs PHP
8.5.11; `config.platform.php` is pinned to 8.5.11). `composer.lock` is committed.

| Piece | File | Notes |
|---|---|---|
| Routes (pages + form posts) | `routes/web.php` | `web` middleware group: cookies, session, CSRF |
| JSON pass-through for the load test | `routes/api.php`, `app/Http/Controllers/Api/PostApiController.php` | `api` group: no session, no CSRF; forwards `Authorization` |
| App wiring | `bootstrap/app.php` | registers `api.php`; `encryptCookies(except: ['token'])`; no `/up` health route |
| API client (uncached) | `app/Support/FeedApi.php` | Laravel `Http` client; same functions as the JS `api.ts` |
| Demo login token + cookie reading | `app/Support/DemoToken.php` | same HS256 header/payload as `sveltekit/src/lib/server/session.ts` (`hash_hmac`) |
| Feed `/`, compose, like | `app/Http/Controllers/FeedController.php` | PRG: 303 back, or to `/login` without a token |
| Post `/posts/{id}` | `app/Http/Controllers/PostController.php` | `abort(404)` if the API says 404/400 |
| Login `/login` | `resources/views/login.blade.php`, `app/Http/Controllers/LoginController.php` | sets the raw JWT in an httpOnly `token` cookie |
| Layout, header with `@username` | `resources/views/components/layout.blade.php` | reads the `token` cookie per request |
| Post card | `resources/views/components/post-card.blade.php` | anonymous Blade component |
| Pages | `resources/views/feed.blade.php`, `post.blade.php`, `errors/404.blade.php` | |
| Settings | `config/feed.php` | `BACKEND_URL`, `JWT_SECRET` |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`, served by nginx |
| nginx | `docker/nginx/nginx.conf` | Laravel's documented server block; 1 worker, gzip off, keep-alive |
| FPM pool | `docker/php-fpm/www.conf` | `pm = static`, 10 children, Unix socket |
| PHP ini | `docker/php/zz-production.ini` | on top of `php.ini-production`: OPcache, `validate_timestamps=0` |
| Image | `Dockerfile`, `docker/entrypoint.sh`, `.dockerignore` | |

Trimmed from the skeleton: Vite/npm files, `database/` (migrations, factories, seeders), the `User` model, tests,
Boost's `AGENTS.md`/`CLAUDE.md`, the welcome page and dev dependencies. The default `cache`, `queue` and `session`
drivers were `database`; they are now `file`, `sync` and `file`, so nothing ever opens SQLite (no database file exists).

## How a request flows

1. **nginx** (one worker process) accepts the connection (keep-alive), finds no static file for `/`, and passes
   the request to `/index.php` over **FastCGI** on `/run/php/php-fpm.sock`. `styles.css` is served by nginx directly.
2. A free **FPM worker** (10 in a static pool; each handles one request at a time) runs `public/index.php`.
3. **Laravel boots, every request**: Composer autoloader, a new application container, service providers, the HTTP
   kernel, global middleware (trim strings, empty strings to null, post size, maintenance, CORS, proxies), routing,
   then the `web` group (decrypt cookies, start the session, CSRF, share errors). PHP's shared-nothing model throws
   all of this away at the end of the request. This framework boot, not the template, is most of the CPU per page,
   which is what the video found.
4. The controller calls the API with Laravel's **Http client** (Guzzle + curl). A new TCP connection is opened to the
   API for each request: nothing survives between requests in a worker, unlike Node's pooled `fetch`.
5. **Blade** renders the page from its **compiled PHP** (`storage/framework/views`, created by `view:cache`). Blade
   components (`<x-layout>`, `<x-post-card>`) are resolved per render; the post card runs 20 times on the feed.
6. The session is written to disk, `laravel-session` and `XSRF-TOKEN` are encrypted into `Set-Cookie` headers, and
   the response goes back through FPM and nginx.

What is cached, and what isn't:

- **OPcache** (built into PHP 8.5) keeps the compiled opcodes of every PHP file (the framework, the app, the cached
  config/routes/events and the compiled Blade views) in shared memory, about 23 MB here. `validate_timestamps=0`:
  files are never re-checked, as in production (the code in the image never changes). JIT is left off (PHP's default).
- **Laravel caches**: `route:cache`, `view:cache` and `event:cache` run in the image build. `config:cache` runs in the
  entrypoint at container start, because it bakes `env()` values in (`BACKEND_URL` is `http://api:4000` in `sim/`,
  only known at run time). With a cached config, `.env` and `env()` are not read per request.
- **No data or response caching.** Every page view calls the API; responses carry `Cache-Control: no-cache, private`
  (Laravel's default), no ETag.

## Sessions and CSRF (the price of Laravel's defaults)

The pages have HTML forms with `@csrf`, Laravel's default protection, which keeps the token in the session. So the
default `web` middleware group is kept: **every page view starts a session**. The skeleton's default session driver is
`database`; with no database here, this uses the **`file` driver**, Laravel's long-time default and the usual choice
for a single server without Redis.

The cost, per page view:

- a session file read (if the request has a session cookie) and **a session file write, always**, in
  `storage/framework/sessions` (inside the container's filesystem);
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

## PHP-FPM pool and nginx

- `pm = static`, `pm.max_children = 10`: the video's "10 workers". Ten processes are always up, and at most ten
  requests run at once; the rest wait in the socket backlog. Every worker blocks on its API call, so the pool size is
  also the concurrency limit (Node's single event loop interleaves requests instead).
- Memory, measured idle after warm-up (10 workers): FPM side **~51 MB** (cgroup), nginx **~11 MB**. Each worker
  shows ~38-42 MB RSS but only ~2-5 MB of it is private; the rest is shared (OPcache, libraries). `memory_limit` is
  128 MB per request (`php.ini-production`). 10 workers are far from the 2 GB limit; the box is CPU-bound, not
  memory-bound, so more workers would only add context switching on one vCPU.
- No FPM access log (the `php` image's `docker.conf`, which logs every request to stderr, is removed) and nginx
  `access_log off`, since the Node variants log nothing per request.
- nginx: `worker_processes 1` (1 vCPU), `gzip off` (nginx's default; only Next.js compresses), keep-alive on
  (`keepalive_timeout 65`), `worker_connections 16384` so thousands of k6 keep-alive connections aren't refused
  (the default is 512/768; Node accepts any number).

## Differences from the JS variants

- **No hydration, no JS.** The pages are plain HTML forms; there is no client runtime and no hydration data. The feed
  page is ~12.7 KB and the post page ~1.1 KB, plus `styles.css` (3,789 bytes) as a separate file served by nginx with
  `ETag`/`Last-Modified` (Astro inlines the CSS; SvelteKit serves a hashed file).
- **Headers on a page:** `Content-Type: text/html; charset=utf-8`, `Transfer-Encoding: chunked` (nginx with FastCGI),
  `Cache-Control: no-cache, private`, two `Set-Cookie` (session + XSRF), `Server: nginx/1.26.3`. No ETag, no
  `Content-Encoding`.
- **Mutations** are separate POST routes, Laravel's usual pattern, rather than actions on the page URL: `POST /posts`
  (compose) and `POST /like` (hidden `id`), each answering `303`. The like redirects back to the page it came from
  (`Referer`, else the session's previous URL); without a `token` cookie both go to `/login`. A rejected post (e.g.
  empty) redirects to `/` and shows the API's error from flashed session data, so the feed answers 303 then 200 (Astro
  and SvelteKit re-render with the API's status). A form post without a valid CSRF token gets Laravel's `419`.
- Laravel's global `TrimStrings` middleware trims the compose body before it is sent to the API (the JS variants
  send it as typed).
- **404:** missing/invalid post ids and unknown paths render `errors/404.blade.php` with status 404.
- **Per-request work** is higher than in Node: PHP re-creates the framework every request (the cost OPcache and the
  Laravel caches reduce but cannot remove), and opens a new connection to the API every time.

## Environment

| Env | Default | |
|---|---|---|
| `BACKEND_URL` | `http://127.0.0.1:4000` | read by `config:cache` at container start |
| `JWT_SECRET` | `twelve-dollar-challenge` | signs `/login` tokens |
| `APP_KEY` | a benchmark-only key in the `Dockerfile` | encrypts the session and XSRF cookies; override with `-e APP_KEY=base64:...` (`php artisan key:generate --show`) for anything real |
| `APP_ENV` / `APP_DEBUG` | `production` / `false` | |
| `LOG_CHANNEL` | `stderr` | |
| `NET_DELAY` | empty | optional `tc netem` delay, as in the other variants |

nginx listens on port 3000 inside the container (`EXPOSE 3000`).

## Build and run

```bash
docker build -t perf-laravel .
docker run --rm -p 3000:3000 -e BACKEND_URL=http://host.docker.internal:4000 perf-laravel
# in sim/: FRONTEND=laravel ./sim.sh ...
```

The image: a `composer:2.10.3` stage runs `composer install --no-dev` and `composer dump-autoload --no-dev
--optimize` (which runs `artisan package:discover`); the runtime stage is `php:8.5.11-fpm-trixie` plus `nginx`,
`iproute2` and `curl` from apt (no extra PHP extensions are needed: the image has ctype, dom, fileinfo, filter,
iconv, mbstring, openssl, session, tokenizer, and OPcache is built into 8.5), uses `php.ini-production`, replaces the
FPM pool config, and runs `route:cache`, `view:cache`, `event:cache`. `docker/entrypoint.sh` applies `NET_DELAY`, runs
`config:cache`, starts `php-fpm -F` in the background, then `exec nginx -g 'daemon off;'`. The healthcheck is
`curl -sf http://127.0.0.1:3000/` every 2 s.

Without Docker build (how this variant was verified): install vendor with the Composer image, then run the same
configs from the stock images, with FPM on TCP instead of the socket since nginx is in another container:

```bash
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v $PWD:/app -w /app composer:2.10.3 install --no-dev -o
# FPM: php:8.5.11-fpm-trixie, app mounted at /var/www/html, php.ini-production + docker/php/zz-production.ini,
#      docker/php-fpm/www.conf with `listen = 127.0.0.1:9413` (and no user/group, running as your uid);
#      run route:cache, view:cache, event:cache, config:cache, then `php-fpm -F`.
# nginx: nginx:1.26.3 with docker/nginx/nginx.conf, `listen 127.0.0.1:3413`, `fastcgi_pass 127.0.0.1:9413`,
#      public/ mounted at /var/www/html/public. Both containers with --network host.
```

Local runs leave `bootstrap/cache/*.php` (including the cached config with `APP_KEY`), compiled views and session
files behind; they are git- and docker-ignored, and `php artisan optimize:clear` removes the caches.
