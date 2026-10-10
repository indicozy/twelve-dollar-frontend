# flask: Flask 3 + Jinja2 under gunicorn, server-rendered, no caching

The Python version of `../sveltekit` and `../astro`. It has the same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page is rendered on every request from a fresh API call, and the pages ship zero JS.
In production it runs as a gunicorn master with **3 sync worker processes** (`gunicorn.conf.py`).

Versions: CPython **3.14.8** (`python:3.14.8-slim`, the latest stable CPython; Flask, Jinja2, gunicorn and requests
all install and run on it), Flask 3.1.3, Jinja2 3.1.6, Werkzeug 3.1.9, gunicorn 26.2.0, requests 2.34.2
(urllib3 2.8.0). All dependencies, transitive ones included, are pinned in `requirements.txt`.

| Piece | File | Notes |
|---|---|---|
| App: API client, session, routes | `app.py` | one module, about 245 lines |
| API client (uncached) | `app.py` (`api = requests.Session()`) | one pooled keep-alive session per worker |
| Demo login token + cookie reading | `app.py` (`sign_token`, `current_username`) | stdlib `hmac`/`hashlib`/`base64`/`json`; same header and payload as the SvelteKit variant |
| Date text | `app.py` (`post_date` filter) | same output as `Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"})` + `" UTC"` |
| Layout, header with `@username` | `templates/base.html` | the username comes from the `token` cookie, read per request (context processor) |
| Post card | `templates/_post.html` | Jinja2 macro, `link=false` on the post page |
| Feed `/` | `templates/index.html` | `GET /feed`; shows `?error=` from a rejected post |
| Post `/posts/<id>` | `templates/post.html` | real **404** for missing or invalid ids |
| Login `/login` | `templates/login.html` | `POST /login` signs the token and sets the httpOnly cookie |
| 404 page | `templates/404.html` | Flask `errorhandler(404)`, status 404, for unknown paths too |
| Form routes | `app.py`: `POST /actions/like`, `POST /actions/create`, `POST /login` | Origin check, then 303 (Post/Redirect/Get) |
| JSON pass-through for the load test | `app.py`: `POST /api/posts`, `POST /api/posts/<id>/like` | forwards `Authorization` as-is |
| gunicorn settings | `gunicorn.conf.py` | bind from `HOST`/`PORT`, 3 sync workers, no access log |
| Stylesheet | `static/styles.css` | verbatim copy of `../shared/styles.css`, served by Flask at `/static/styles.css` |

## How it renders

- **Jinja2 compiles each template once.** On the first `render_template`, Jinja2 parses the template, generates Python
  source for it, and compiles that to bytecode. The environment caches the compiled template (and, in production
  with `TEMPLATES_AUTO_RELOAD` off, never checks the file again). Every render after that is plain Python running
  the compiled function: string building with `markupsafe` escaping, then `"".join(...)`. Each of the 3 workers
  compiles its own copy on its first request.
- **Autoescaping is on** (Flask's default for `.html` templates), so post bodies and usernames are HTML-escaped.
  `trim_blocks`/`lstrip_blocks` are on to keep the output free of the blank lines `{% %}` tags would leave.
- **Not streamed.** The page is rendered fully, then sent with a `Content-Length`, so a missing post is a real 404.
- **Data.** Each request does one `requests` call through a module-level `requests.Session`, which keeps a urllib3
  connection pool with keep-alive to the API. No response or HTML caching anywhere. There's no request timeout,
  like the JS variants' `fetch` (gunicorn's 30 s worker timeout is the backstop).

## Process model: why 3 sync workers

gunicorn's docs recommend `(2 x $num_cores) + 1` workers as a starting point. The simulated server has 1 vCPU, so
`workers = 3`, written into `gunicorn.conf.py` rather than computed from `os.cpu_count()`, which would see the host's
cores and not the container's CPU quota. (The video this benchmark follows ran FastAPI with 3 uvicorn workers.)

- **The default `sync` worker handles one request at a time per process.** While it waits on the API call it
  blocks: that process does nothing else, even though it uses no CPU. With 3 workers the server has at most 3
  requests in flight; anything else waits in the listen backlog (gunicorn's default `backlog` is 2048). This is
  the reason for "2 per core + 1": while one worker waits on I/O, another can use the CPU.
- **At 0.4 vCPU** the 3 processes share 40% of a core under the CFS quota. Rendering
  a page is pure Python and CPU-bound, so throughput is capped by the quota, not by the worker count. More workers
  would add memory and context switching but no CPU. The 3 workers still overlap API waits with rendering.
- **No keep-alive.** gunicorn's sync worker closes the connection after every response (`Connection: close`) and
  ignores the `keepalive` setting (documented: "sync worker does not support persistent connections"). The load
  test (k6) expects keep-alive, so with this variant every request pays a new TCP connection (and k6 sees it in
  `http_req_connecting`). The `gthread` or `gevent` worker classes do keep-alive, but the benchmark uses the
  default sync worker on purpose. The connection from Flask to the API does use keep-alive (requests' pool).
- **Memory.** Idle, measured in a `python:3.14.8-slim` container: master about 32 MB RSS, each worker about 43 MB RSS
  (PSS about 23 MB + 3 x 31 MB = about 118 MB in total; `docker stats` showed 106 MiB).
- **No `preload_app`.** Each worker imports `app.py` after the fork, so each has its own `requests.Session`
  and no socket is shared between processes.

## Differences from the JS variants

- **No hydration, zero JS.** Like Astro: forms are plain HTML posts. Nothing is embedded besides the markup.
- **Payload.** The feed page is about 10.5 to 11 KB and the post page about 1 KB. The stylesheet is a separate file
  (`/static/styles.css`, 3,789 bytes, `Cache-Control: no-cache` with ETag/Last-Modified, from Flask's
  `send_file`), like Next.js and SvelteKit; Astro inlines it.
- **Response headers for pages:** `Content-Type: text/html; charset=utf-8`, `Content-Length`, `Connection: close`,
  `Server: gunicorn`. No ETag, no `Cache-Control`, no compression (neither Flask nor gunicorn compresses).
- **Origin check on the form routes.** Flask has no CSRF or origin protection of its own. `POST /actions/like`,
  `POST /actions/create` and `POST /login` apply the same rule as the Nuxt variant (and Next.js server actions): if the
  request has an `Origin` header, its host must equal the `Host` header, else 403. It works on any host name over plain
  http with no configuration. Requests without `Origin` (old browsers, curl) are allowed. The JSON routes under
  `/api` aren't checked, like in the other variants.
- **Form routes, not page actions.** Like Nuxt, forms post to `/actions/like` and `/actions/create`. The like
  redirects back to the page it came from (same-origin `Referer` path, else `/`). A rejected post redirects to
  `/?error=<message>` and the feed shows the API's message (for example "body is required"), like Nuxt and Angular.
  Without a `token` cookie both redirect to `/login`.
- **Strict JSON on `/api/posts`.** The raw body is parsed with `json.loads` (not `request.get_json(silent=True)`,
  which can't tell bad JSON from `null`); invalid JSON or `null` gets 400 `{"error":"malformed JSON body"}`. The API's
  status and body bytes are returned unchanged with `Content-Type: application/json`.
- **Status reason phrases** are Werkzeug's, e.g. `201 CREATED`, `303 SEE OTHER`.

## Build and run

```bash
python3.14 -m venv .venv && .venv/bin/pip install -r requirements.txt
HOST=0.0.0.0 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge \
  .venv/bin/gunicorn -c gunicorn.conf.py app:app
```

The Docker image (`python:3.14.8-slim` + `iproute2`) installs `requirements.txt` with `--no-cache-dir`, copies `app.py`,
`gunicorn.conf.py`, `templates/` and `static/`, applies the optional `NET_DELAY` with `tc netem`, then
`exec gunicorn -c gunicorn.conf.py app:app` on `0.0.0.0:3000`. The healthcheck uses Python's `urllib`.
