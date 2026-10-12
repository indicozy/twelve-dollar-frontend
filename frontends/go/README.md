# go: Go standard library (net/http + html/template), server-rendered on every request, no caching

The "no framework" Go baseline: the same app as `../express` and `../rust-axum` (routes, markup, forms, Origin check,
JSON passthrough routes; `../SPEC.md`, `../shared/styles.css`) written against the standard library only. Every page
request calls the API with one shared `http.Client` and renders fresh HTML from an `html/template`; nothing is cached.
One process. **The pages ship zero JS**: likes, new posts and sign-in are plain HTML forms that post to Go handlers and
get a `303` back (Post/Redirect/Get).

| | |
|---|---|
| Versions | Go **1.27.2** (`golang:1.27.2-bookworm` build stage), runtime image `debian:bookworm-20261005-slim` (+ `iproute2`, `curl`) |
| Dependencies | none: `go.mod` has no `require`, so there is no `go.sum` |
| Packages used | `net/http` (server, Go 1.22+ `ServeMux` method/wildcard patterns, client), `html/template`, `encoding/json`, `crypto/hmac` + `crypto/sha256` (HS256), `encoding/base64`, `embed` |
| Binary | static (`CGO_ENABLED=0`, `-trimpath -ldflags='-s -w'`), templates and stylesheet embedded with `//go:embed` |
| Feed page | about 10.5 KB (10,516 bytes measured, 4 bytes more than Express only because of the title/stack name) |

| Piece | File | Notes |
|---|---|---|
| Mux, handlers, startup | `main.go` | pages, form handlers, Origin check, JSON passthrough, `/styles.css`, 404 fallback, graceful SIGTERM |
| API client (one shared `http.Client`, uncached) | `api.go` | `Feed`, `Post`, `CreatePost`, `LikePost`; `Post.Date()` for the date text |
| Demo login token + cookie reading | `session.go` | same HS256 header/payload JSON as `../express/lib/session.js` |
| Layout (header with `@username` or "Sign in") | `templates/layout.html` | defines `layout`, which calls the page's `content` |
| Post card | `templates/post_card.html` | `{{template "post_card" card . true}}` (feed) / `card .Post false` (post page) |
| Feed `/`, post `/posts/{id}`, `/login`, 404 | `templates/index.html`, `post.html`, `login.html`, `not_found.html` | each defines `content` |
| Stylesheet | `static/styles.css` | verbatim copy of `../shared/styles.css` |

## Routes

Same as `../express/README.md` (Routes table and Origin check), registered as `ServeMux` patterns:
`GET /{$}`, `GET /posts/{id}`, `GET /login`, `POST /login`, `POST /actions/create`, `POST /actions/like`,
`POST /api/posts`, `POST /api/posts/{id}/like`, `GET /styles.css`, and `/` (everything else, any method) → the 404 page
with status 404. Because the catch-all `/` matches every method, a wrong method gets the 404 page, not a 405 (as in
Express). `r.PathValue("id")` is percent-escaped again with `url.PathEscape` before it goes to the API.

- Form routes (`/login`, `/actions/*`) are wrapped in the same Origin rule as the other variants (Origin present →
  its `host[:port]` must equal `Host`, else 403 "Cross-site form submission"). Forms are read with `PostFormValue`.
- `POST /api/posts`: the raw body (max 1 MiB) is decoded strictly (one JSON value, nothing after it); invalid, empty or
  `null` → 400 `{"error":"malformed JSON body"}`; `{"body": x}` is forwarded as `String(x)` (string as-is, number as
  written, missing → `""`). The API's status and body bytes are streamed back unchanged with
  `Content-Type: application/json; charset=utf-8`.
- `/?error=` redirects encode the API message like `encodeURIComponent` (`%20` for spaces).

## How it renders

- **Templates are parsed once at startup.** `layout.html` + `post_card.html` are parsed into a base set (with one
  template func, `card`, that pairs a post with the link flag); each page is `base.Clone()` + its own file, so the four
  pages are four ready `*template.Template`s held in a map. No re-parsing per request.
- **A render** is `ExecuteTemplate(buf, "layout", data)`: `html/template` walks the parsed tree with reflection,
  writing literal text and contextually escaped values into a `bytes.Buffer` taken from a `sync.Pool`. The header's
  `@username` is decoded from the `token` cookie's JWT payload per request (not verified, like the JS variants). The
  date is a method on the post (`Post.Date()`, `time.Format("Jan 2, 2006, 3:04 PM") + " UTC"`, identical to the JS
  `Intl.DateTimeFormat` output).
- **Not streamed.** The whole page is rendered first, then sent with `Content-Length`, so a missing post is a real 404
  and a template error is a clean 500.
- **No ETag** on pages (net/http doesn't add one; neither does the Rust variant). `/styles.css` is served from the
  embedded bytes through `http.ServeContent` with a fixed `ETag` and `Cache-Control: public, max-age=0`, so it answers
  `If-None-Match` with 304.
- **Escaping.** `html/template` escapes `& < > " '` like EJS (`&amp; &lt; &gt; &#34; &#39;`) and additionally escapes
  `+` as `&#43;` (and NUL). Rendered text is identical; a post body containing `+` is 4 bytes longer per `+` than the
  Express output. Apart from that, `/`, `/posts/1`, `/login` and the 404 page are byte-for-byte the Express markup
  except for the title and stack name.

## Process and concurrency model

One process. net/http serves each connection on its own goroutine (HTTP/1.1 keep-alive); while a handler blocks on
the API call, the goroutine parks and the scheduler runs others. Rendering runs on whichever OS thread the goroutine
is on, so up to `GOMAXPROCS` pages render in parallel.

- **GOMAXPROCS is left at the runtime default.** Since Go 1.25 the default is container-aware: it is the lower of the
  CPU count and the cgroup v2 `cpu.max` quota, rounded up, **with a minimum of 2**. In the sim-like test container
  (`--cpus 0.4`, 20 host CPUs) the startup log shows `GOMAXPROCS=2, NumCPU=20`. With a 0.4 CPU quota, two Ps can
  briefly run in parallel and then be throttled by CFS; set `GOMAXPROCS=1` in the environment to change it. The GC is
  also left at defaults (`GOGC=100`, no `GOMEMLIMIT`).
- **API client.** One `http.Client` with a clone of `http.DefaultTransport`, `MaxIdleConns`/`MaxIdleConnsPerHost`
  raised to 512 (the default of 2 idle connections per host would make most API calls under load open and close a new
  TCP connection), `IdleConnTimeout` 90 s. Response bodies are always drained and closed so connections go back to the
  pool. No request timeout (like the JS `fetch`).
- **Server.** `http.Server` with `ReadHeaderTimeout` 10 s and `IdleTimeout` 60 s (client keep-alive). No compression.
  Go sets `TCP_NODELAY` on accepted connections by default.
- **SIGTERM.** `signal.NotifyContext` + `srv.Shutdown` (2 s grace), so `docker stop` exits promptly as PID 1.
- **Memory.** About 4 MiB (`docker stats`) idle, about 15 MiB after the 300-VU load check.

## Build and run

```bash
go build -o feed-frontend .     # Go >= 1.27.2 (go.mod)
HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge ./feed-frontend
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`), optionally `GOMAXPROCS`.

The Dockerfile has two stages: `golang:1.27.2-bookworm` builds the static binary; `debian:bookworm-20261005-slim`
(+ `iproute2` for `tc netem`, `curl` for the healthcheck) runs it. The CMD applies the optional `NET_DELAY` with
`tc netem`, then `exec feed-frontend`. The healthcheck is `curl -sf http://127.0.0.1:3000/` every 2 s, 30 retries.
