# rust-axum: Rust / Axum + Askama on Tokio, server-rendered on every request, no caching

The Rust version of `../sveltekit` and `../astro`. Same pages, markup, classes and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page request calls the Rust + SQLite API over HTTP and renders fresh HTML; nothing is
cached. One process, the standard `#[tokio::main]` multi-threaded runtime. **The pages ship zero JS**: likes, new
posts and sign-in are plain HTML forms that post to Axum handlers and get a `303` back (Post/Redirect/Get).

Versions (exact pins in `Cargo.toml`, `Cargo.lock` committed): Rust 1.90, `axum` 0.8.9 (hyper 1.12, hyper-util
0.1.21, matchit 0.8.4), `askama` 0.16.1, `tokio` 1.53.2, `reqwest` 0.13.5 (`default-features = false`: HTTP/1 only, no
TLS, so no OpenSSL/rustls in the binary), `serde` 1.0.229, `serde_json` 1.0.151, `time` 0.3.55, `hmac` 0.12.1,
`sha2` 0.10.9, `base64` 0.22.1. Allocator: the default system allocator (glibc malloc), the usual choice for Axum
apps (the API in `backend/` uses mimalloc; this frontend does not).

| Piece | File | Notes |
|---|---|---|
| Router, handlers, startup | `src/main.rs` | pages, form handlers, JSON passthrough, `/styles.css`, 404 fallback |
| API client (one shared `reqwest::Client`, uncached) | `src/api.rs` | `feed`, `post`, `create_post`, `like_post`; `encodeURIComponent` for ids |
| Demo login token + cookie reading | `src/session.rs` | same HS256 header/payload JSON as `sveltekit/src/lib/server/session.ts` |
| Date text | `src/date.rs` | `Dec 31, 2025, 11:59 PM UTC`, identical to `Intl.DateTimeFormat("en", {dateStyle:"medium", timeStyle:"short", timeZone:"UTC"})` |
| Layout (header with `@username` or "Sign in") | `templates/layout.html` | the token cookie's JWT payload is decoded per request |
| Post card | `templates/post_card.html` | `{% include %}`d by the feed (`link = true`) and post page (`link = false`) |
| Feed `/`, post `/posts/{id}`, `/login`, 404 | `templates/index.html`, `post.html`, `login.html`, `not_found.html` | |
| Stylesheet | `static/styles.css` | verbatim copy of `../shared/styles.css` |

## Routes

| Route | What it does |
|---|---|
| `GET /` | `GET {BACKEND_URL}/feed`, renders header, compose form (with `?error=` message if any), "Latest", 20 posts |
| `GET /posts/{id}` | `GET {BACKEND_URL}/posts/:id`; API 404/400 → the 404 page with status **404** |
| `GET /login` | the sign-in form |
| `POST /login` | form → signs `{"sub":"<id>","username":"<name>","iat":..,"exp":..+7d}` with `JWT_SECRET`, sets `token` cookie (`HttpOnly; SameSite=Lax; Path=/`), 303 to `/` (bad input → `/login?error=1`) |
| `POST /actions/like` | form (`id`) → `POST /posts/:id/like` with `Authorization: Bearer <token cookie>`, 303 back to the Referer's path (same host) or `/` |
| `POST /actions/create` | form (`body`) → `POST /posts`; 303 to `/`, or to `/?error=<API message>` (e.g. "body is required") |
| `POST /api/posts` | JSON passthrough: raw body parsed strictly with serde_json (invalid → 400 `{"error":"malformed JSON body"}`), sends `{"body": ...}`, `Authorization` forwarded as-is |
| `POST /api/posts/{id}/like` | JSON passthrough, `Authorization` forwarded as-is |
| `GET /styles.css` | `include_str!` of `static/styles.css`, `content-type: text/css; charset=utf-8` |
| anything else | the 404 page, status 404 (header still shows the signed-in user) |

The form handlers redirect to `/login` when there is no `token` cookie. The JSON routes return the API's status and its
body bytes unchanged (`content-type: application/json`); they are not re-serialized.

**Origin check.** Axum has no CSRF/origin protection of its own, so the form routes (`/login`, `/actions/*`) apply the
same rule as the Nuxt variant and Next.js server actions: if an `Origin` header is present, its `host[:port]` must equal
the `Host` header, otherwise **403** "Cross-site form submission". Requests without `Origin` pass. This works over plain
http on `localhost:3000`, `127.0.0.1:3000` or the sim's IP with no build-time config. The `/api/*` JSON routes are not
checked (like every other variant). The cookie is `SameSite=Lax`.

## How Askama renders

Templates are Jinja-like files in `templates/`. `#[derive(Template)]` reads them **at compile time** and generates
Rust code (a `render_into` that writes the literal chunks and the escaped fields into a `fmt::Write`) for each page
struct. There is no runtime template parsing, no template cache and no template files in the image: a render is plain
Rust code appending to one `String` (pre-sized from the template's size hint), which is then sent as the body.
`{% extends %}`, `{% block %}` and `{% include %}` are resolved at build time too, so the post card is inlined into
the feed's loop. The date text is a `Display` value written straight into the buffer.

HTML escaping is on by default and kept. Askama escapes `& < > " '` as numeric entities (`&#38; &#60; &#62; &#34;
&#39;`), so a body with quotes or apostrophes is a few bytes longer than with `&quot;`/`&lt;`-style escaping in some JS
variants. The rendered text is the same.

## Concurrency model

`#[tokio::main]` starts Tokio's multi-threaded, work-stealing runtime. Each accepted connection is a task (hyper
HTTP/1.1 with keep-alive), each request a future on that task; while a handler awaits the API call, the worker thread
runs other requests. The API client is one `reqwest::Client` (hyper-util pool) shared by all handlers: idle
keep-alive connections to the API are reused, no per-request connection setup. Rendering itself is synchronous
CPU work on the worker thread (microseconds for a page).

Worker threads = `std::thread::available_parallelism()` (or `TOKIO_WORKER_THREADS`), which reads the sched affinity
**and** the cgroup v2 `cpu.max` quota (floor, minimum 1). Checked with the host binary in a `debian:bookworm-slim`
container: `--cpuset-cpus 16-19` → 4 workers; `--cpuset-cpus 16-19 --cpus 0.4` → **1**; `--cpus 1` → 1;
`--cpuset-cpus 16 --cpus 0.4` (the sim's 0.4/1-vCPU setup) → **1 worker**. Tokio's blocking pool is only used to resolve
`BACKEND_URL` when it is a host name, once per new pooled connection (IP literals skip DNS). The server logs the worker count
on startup. Sockets get `TCP_NODELAY` (via `ListenerExt::tap_io`), as Node does by default.

## Differences from the JS variants

- **No hydration, zero JS.** No framework runtime, no serialized page data, no `<script>` at all. The forms are plain
  `<form method="post">` (like Astro); there is no enhanced/fetch submit, so a "Posting…" pending state does not
  exist.
- **Payload.** Feed page ~10.5 KB, post page ~1.0 KB (CSS is a separate `<link>`ed file, 3,789 bytes, not inlined).
  Astro's feed page is ~13-15 KB with the CSS inlined; SvelteKit's ~16-19 KB.
- **Headers.** `content-type: text/html; charset=utf-8`, `content-length` (the page is fully rendered before sending,
  so no chunked encoding), `date`. No `etag`, no `cache-control`, no compression (no tower-http compression layer;
  other variants don't compress in-process either). `/styles.css` has no cache headers either.
- **Real 404s** for a missing/invalid post id and for unknown paths (like SvelteKit/Astro; Next.js sends 200).
- **Errors.** If the API is unreachable or returns an unexpected status, the page answers a plain 500 and logs it.

## Build and run

```bash
cargo build --release                 # target/release/feed-frontend (~2 MB, LTO fat, codegen-units=1, panic=abort)
HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 ./target/release/feed-frontend
cargo test && cargo clippy --all-targets
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`).

The Dockerfile builds in `rust:1.90-slim-bookworm` (dependencies cached in their own layer with a dummy `main.rs`,
then the real build with `templates/` and `static/`), and runs on `debian:bookworm-slim` with only `curl` and
`iproute2` added (no OpenSSL or CA certs needed: the API is plain http). It applies the optional `NET_DELAY` with
`tc netem`, listens on `0.0.0.0:3000`, and has the same `curl` healthcheck as the other variants.
