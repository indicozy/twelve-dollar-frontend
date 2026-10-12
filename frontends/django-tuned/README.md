# django-tuned: `../django` + precompiled stdlib bytecode + Django's built-in Jinja2 backend

Identical to `../django` (Django 6.1 on gunicorn, 3 sync workers, same views, middleware, CSRF, WhiteNoise, no caching)
except for two changes:

| Change | Where | Why |
|---|---|---|
| `RUN python -m compileall -q /usr/local/lib/python3.14` | `Dockerfile` | `python:3.14.8-slim` ships most of the stdlib without `.pyc` (no `email/__pycache__`, `http/__pycache__`, ...) and the image sets `PYTHONDONTWRITEBYTECODE=1`, so every `HEALTHCHECK` (`python -c "import urllib.request; ..."`, every 2 s, inside the container's cgroup) recompiled `urllib.request`, `http.client` and `email` from source: 134 ms vs 21 ms per import. Idle container: **83 → 27 ms CPU per second** (21% → 7% of a 0.4 quota). `../flask` has the same healthcheck and the same problem. |
| Render with `django.template.backends.jinja2.Jinja2` | `feedsite/settings.py`, `feedsite/jinja2_env.py`, `web/jinja2/` | `perf` (`PYTHONPERFSUPPORT=1`) of `../django` put ~30% of CPU in the Django template walk (`IncludeNode` x20 per feed, `VariableNode`). Jinja2 compiles templates to Python code. Adds `Jinja2==3.1.6`, `MarkupSafe==3.0.4`. The old `web/templates/` are still in the directory but unused. Output is identical ignoring whitespace, except an apostrophe in user text is escaped `&#39;` instead of `&#x27;`. |

Measured standalone (0.4 CPU, 60 s at fixed users; instructions counted with `perf stat` on the container's cgroup):

| | users | CPU ms/request | M instructions/request | p95 / p99 | memory avg |
|---|---|---|---|---|---|
| `../django` | 800 | 4.28 | 18.9 | 57 / 74 ms | 138 MiB |
| Jinja2 only | 800 | 4.01 | 18.5 | 57 / 76 ms | 141 MiB |
| `django-tuned` (both) | 800 | 3.89 | 12.0 | 35 / 467 ms | 123 MiB |
| `../django` | 1,300 | 3.16 | 14.4 | 335 / 804 ms | 141 MiB |
| `django-tuned` | 1,300 | 2.91 | 10.9 | 61 / 324 ms | 123 MiB |
| `../flask` (reference) | 800 | 3.41 | 15.0 | 46 / 63 ms | 112 MiB |

So the healthcheck fix is most of it; Jinja2 is a few percent. (Error rates of 1-4% in these runs came from the shared
API container being reset by the main benchmark mid-run, not from the frontend; they hit both variants equally.)

---

*The rest of this README is `../django`'s.*

## Original README: django — Django 6.1 + Django templates on gunicorn (3 sync workers), no caching, no database

The Django version of `../sveltekit` and `../astro`. It has the same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page is rendered on the server on every request from a fresh API call. The pages ship
**zero JavaScript**: the like and compose forms are plain HTML forms that post and redirect back.

Versions: CPython **3.14** (`python:3.14.8-slim`; 3.14 is the newest CPython that Django 6.1 supports), `Django` 6.1.2,
`gunicorn` 26.2.0, `requests` 2.34.2 (API client), `whitenoise` 6.12.0 (static files). Every transitive dependency is
pinned in `requirements.txt` too.

| Piece | File | Notes |
|---|---|---|
| Settings | `feedsite/settings.py` | `DATABASES = {}`, DEBUG off, minimal apps and middleware, env config |
| Routes, `handler404` | `feedsite/urls.py` | no trailing slashes |
| WSGI entry | `feedsite/wsgi.py` | `feedsite.wsgi:application` |
| gunicorn config | `gunicorn.conf.py` | 3 sync workers, bind from `HOST`/`PORT` |
| API client (pooled, uncached) | `web/api.py` | one module-level `requests.Session` per worker |
| Demo login token + cookie reading | `web/session.py` | same HS256 JWT as the SvelteKit variant (stdlib `hmac`) |
| Views (pages, form handling, JSON routes, 404) | `web/views.py` | |
| `@username` for the header | `web/context_processors.py` | reads the `token` cookie per request |
| Date formatting | `web/templatetags/feed_tags.py` | `utc_medium` filter: `Dec 31, 2025, 11:59 PM UTC` |
| Templates | `web/templates/` | `base.html`, `feed.html`, `post.html`, `_post.html` (the post card), `login.html`, `404.html` |
| Stylesheet | `static/styles.css` | verbatim copy of `../shared/styles.css` |

## Routes

| Route | What it does |
|---|---|
| `GET /` | `GET {BACKEND_URL}/feed`, renders the compose form and the 20 posts. Shows `?error=…` in the compose form |
| `POST /?create` | compose form: `POST /posts` with `Authorization: Bearer <token cookie>`, then 303 to `/`, or to `/?error=<API error>` if the API rejects it (e.g. `body is required`), or to `/login` when signed out |
| `POST /?like`, `POST /posts/<id>?like` | like form on each card: `POST /posts/:id/like`, then 303 back to the same page (or `/login`) |
| `GET /posts/<id>` | `GET {BACKEND_URL}/posts/:id`; a missing post (API 404/400) raises `Http404` → the not-found page, status 404 |
| `GET/POST /login` | form; the POST signs a JWT, sets the `token` cookie (httpOnly, SameSite=Lax, path /) and 303s to `/` |
| `POST /api/posts` | JSON passthrough for the load test (`@csrf_exempt`): strict JSON parse (400 `{"error":"malformed JSON body"}` otherwise), sends `{"body": …}` with the incoming `Authorization` header (or none), returns the API's status and JSON body byte for byte |
| `POST /api/posts/<id>/like` | same, for likes |
| anything else | the not-found page, status 404 (`handler404`) |

The forms post back to the page they are on (`action="?like"`, `action="?create"`), like SvelteKit's `?/like`, so
the view knows where to redirect without reading `Referer`. `<id>` uses Django's `int` converter, so `/posts/abc`
never matches a route and gets the 404 page without an API call (the JS variants ask the API, which answers 400, and
then render the same 404).

## How Django templates render

- **Compile once per worker.** The first time a worker renders `feed.html`, the loader reads the file and the
  template engine lexes and parses it into a `Template` object: a tree of `Node` objects (`TextNode`,
  `VariableNode`, `IfNode`, `ForNode`, `IncludeNode`, `ExtendsNode`/`BlockNode`, …). With `DEBUG = False` and no
  explicit `loaders`, Django wraps the app-directories loader in the **cached loader**, so the compiled tree is kept
  for the life of the process. This caches *code*, not data: there is no cache framework, no per-view cache and no
  HTTP caching anywhere.
- **Render = walking the tree in Python.** Each request builds a `Context` (the view's dict plus the context
  processors: the built-in `csrf` one and `current_user`), and `render()` calls `node.render(context)` recursively and
  joins the strings. Each `{{ var }}` resolves a dotted lookup, applies filters, and **autoescapes** the result
  (autoescaping stays on). The feed renders `_post.html` 20 times through `{% include %}` (the included template is
  compiled once and cached in the render context). The date filter is plain Python string formatting: Django's `date`
  filter would write `p.m.`, and `strftime` pads the day and hour with zeros. The output was checked against Node 24's
  `Intl.DateTimeFormat` on 503 timestamps (including 12:xx AM/PM). The whole page is built in memory and sent with a
  `Content-Length`; nothing is streamed.

## The request path

gunicorn sync worker → WSGI `application` → Django's `WSGIHandler` builds a `WSGIRequest` → middleware, in order:

| Middleware | Adds per request |
|---|---|
| `SecurityMiddleware` | checks the SSL redirect setting (off), then adds `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin` (no HSTS: plain http) |
| `WhiteNoiseMiddleware` | one dict lookup of the path in its in-memory table of static files (built once at startup); serves `/static/…` itself, passes everything else on |
| `CommonMiddleware` | validates `Host` against `ALLOWED_HOSTS` (400 otherwise), checks `DISALLOWED_USER_AGENTS`/`PREPEND_WWW`; on a 404 it also tries `path + "/"` for `APPEND_SLASH` (no route has a slash, so it never redirects) |
| `CsrfViewMiddleware` | reads the `csrftoken` cookie; for POSTs to non-exempt views checks the `Origin` header against the host/`CSRF_TRUSTED_ORIGINS` and the form's `csrfmiddlewaretoken` against the cookie (403 otherwise); because every page has a form, `get_token()` runs, so every page response carries `Set-Cookie: csrftoken=…` (re-sent even when the browser already has it, to refresh its expiry) and `Vary: Cookie` |
| `XFrameOptionsMiddleware` | adds `X-Frame-Options: DENY` |

→ URL resolver → view (API call, `render()`) → back out through the middleware's response hooks. There is no session,
auth or messages middleware (they need the DB-backed apps), no `GZipMiddleware` and no `ConditionalGetMiddleware` (so
no compression and no ETag on pages, like Astro and SvelteKit's adapter-node).

Response headers of a plain `GET /` (no cookies):

```
HTTP/1.1 200 OK
Server: gunicorn
Connection: close
Content-Type: text/html; charset=utf-8
X-Frame-Options: DENY
Vary: Cookie
Content-Length: 14002
X-Content-Type-Options: nosniff
Referrer-Policy: same-origin
Cross-Origin-Opener-Policy: same-origin
Set-Cookie: csrftoken=…; expires=…; Max-Age=31449600; Path=/; SameSite=Lax
```

No `Content-Encoding` (even with `Accept-Encoding: gzip, br`), no `ETag`, no `Cache-Control`.

## No database

`DATABASES = {}` (Django falls back to its dummy backend, which raises if anything queries). `INSTALLED_APPS` is only
`django.contrib.staticfiles` and `web`: no admin, auth, contenttypes, sessions or messages, and the middleware that
needs them is gone. The signed-in user is the `username` claim of the `token` cookie, decoded on each request in a
context processor (not verified; the API verifies the token on every write, as in the other variants). `USE_I18N =
False` because the app has no translations (startproject's default is `True`).

**CSRF** is Django's default protection and needs no DB: the token lives in the `csrftoken` cookie and every form has
a `{% csrf_token %}` hidden input (the feed page has 21 of them, all the same masked value, about 100 bytes each).
Over plain http Django checks `Origin` (not `Referer`, which it only checks for https). `CSRF_TRUSTED_ORIGINS`
defaults to `http://localhost:3000,http://127.0.0.1:3000,http://web:3000`, and same-host origins are accepted anyway,
so forms work on `localhost:3000`, `127.0.0.1:3000` and any port. `ALLOWED_HOSTS` defaults to `localhost,127.0.0.1,web`
(the benchmark sends `Host: web:3000`); any other `Host` gets a 400. The `/api/*` JSON routes are `@csrf_exempt`.

## Process model: gunicorn, 3 sync workers (same as `../flask`)

- `gunicorn -c gunicorn.conf.py feedsite.wsgi`: one master process (no requests, it only supervises) and **3 worker
  processes**. gunicorn's documented starting point is `(2 × CPU cores) + 1`; the benchmark server has 1 vCPU, so 3.
  It is fixed in the config (overridable with `WEB_CONCURRENCY`) rather than computed with `os.cpu_count()`, which
  inside a container reports the host's cores, not the CPU quota.
- **Default sync workers.** A worker handles one request at a time and blocks while it waits for the API, so at most
  3 requests are in progress and the rest wait in the socket backlog (2048). The extra workers keep the CPU busy
  while one worker waits on I/O, and Python's GIL doesn't matter because they are separate processes. With
  `CPUS=0.4` the 3 workers share 40% of one core: under load they queue for CPU, not for the API.
- **No HTTP keep-alive to clients.** Sync workers answer every request with `Connection: close` (gunicorn's
  `keepalive` only applies to async workers), so each client request is a new TCP connection. The Node variants keep
  connections alive.
- **Keep-alive to the API.** Without `--preload`, each worker imports the app after the fork, so each has its own
  module-level `requests.Session` with one pooled keep-alive connection to the API.
- Defaults otherwise: 30 s worker timeout, no access log. gunicorn 26 also opens a control socket for `gunicornc`
  (`$HOME/.gunicorn/gunicorn.ctl` in the container), served by a thread in the master.

Idle memory (after a few hundred requests): master ≈ 27 to 32 MB RSS, each worker ≈ 49 to 51 MB RSS. That is about
175 to 185 MB RSS in total, or about 115 to 140 MB PSS, because the workers share pages with the master.

## Static files: WhiteNoise

`/static/` is served by WhiteNoise from the same gunicorn workers, which is the standard way to serve a Django app's
static files without a separate web server. Storage is `CompressedManifestStaticFilesStorage`:

- `collectstatic` (at image build time) writes `styles.<hash>.css` plus a pre-gzipped `.gz` copy.
- `{% static 'styles.css' %}` resolves to the hashed name from the manifest (loaded once), and WhiteNoise serves it
  with `Cache-Control: max-age=315360000, public, immutable`, an ETag, and gzip when accepted (1,392 bytes instead of
  3,789), with no compression work at request time.

This matches what SvelteKit and Next.js do with their CSS (a hashed, immutable, precompressed file), so a browser
downloads it once. Brotli copies would need the `Brotli` package, which isn't installed. The load test only requests
pages, so the CSS file isn't part of the benchmark's traffic.

## Differences from the other variants

- **vs the JS variants.** No hydration and no client JS at all (like Astro). The feed page is about 14.0 KB and the
  post page about 1.2 KB, because the CSS is a separate cached file instead of an inline `<style>` (Astro inlines
  3.2 KB per page). The 21 hidden CSRF inputs add about 2 KB to the feed page. Each page response sets the CSRF cookie.
  A missing post is a real 404. Sync workers close the connection after every response.
- **vs Flask.** The same process model, API client approach and templates. Per request, Django does more: a
  five-middleware stack (host validation, CSRF cookie and token handling, three security headers, X-Frame-Options,
  WhiteNoise's lookup), URL resolution through the resolver, context processors, and the Django template engine (which
  evaluates a node tree in Python; Jinja2 compiles templates to Python bytecode).

## Environment

| Env | Default | |
|---|---|---|
| `BACKEND_URL` | `http://127.0.0.1:4000` | the Rust API |
| `JWT_SECRET` | `twelve-dollar-challenge` | signs the demo tokens on `/login` |
| `HOST`, `PORT` | `0.0.0.0`, `3000` | gunicorn's bind address (`gunicorn.conf.py`) |
| `WEB_CONCURRENCY` | `3` | gunicorn workers |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,web` | comma-separated |
| `CSRF_TRUSTED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,http://web:3000` | comma-separated |
| `DJANGO_SECRET_KEY` | a public benchmark-only value | set it for anything real. The app signs nothing with it, but `check --deploy` flags it (W009) |
| `NET_DELAY` | (none) | Docker only: `tc netem` delay on `eth0`, as in the other variants |

`DEBUG` is always `False`; there is no switch for it.

`python manage.py check --deploy` reports 4 warnings, all deliberate for a plain-http benchmark: W004 (no HSTS),
W008 (no SSL redirect), W016 (CSRF cookie not `Secure`), and W009 (the default secret key; set `DJANGO_SECRET_KEY`).
The checks that apply without TLS (DEBUG, `ALLOWED_HOSTS`, nosniff, X-Frame-Options, referrer policy, COOP) pass.
There are no session-cookie warnings because sessions aren't installed.

## Build and run

```bash
python3.14 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py collectstatic --noinput        # writes staticfiles/ (gitignored)
.venv/bin/python manage.py check --deploy
HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 .venv/bin/gunicorn -c gunicorn.conf.py feedsite.wsgi
```

The Dockerfile uses `python:3.14.8-slim`. It installs `iproute2` (for `tc`), installs the pinned requirements with
`pip --no-cache-dir`, copies the app, and runs `collectstatic` at build time. The healthcheck is Python's `urllib`
fetching `/`. The image exposes 3000 and runs `exec gunicorn -c gunicorn.conf.py feedsite.wsgi` after applying the
optional `NET_DELAY`.
