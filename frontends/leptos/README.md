# leptos: Leptos 0.8 SSR + hydration on Axum, server-rendered on every request, no caching

The Rust full-stack-framework counterpart of `../rust-axum`: same pages, markup, classes and CSS (`../SPEC.md`,
`../shared/styles.css`), but written as one Leptos app (components, resources, `#[server]` functions) that is rendered
on the server by `leptos_axum` and **hydrated** in the browser by a WASM bundle, the layout of the official
`leptos-rs/start-axum` template. Every page request calls the Rust + SQLite API over HTTP and renders fresh HTML;
nothing is cached. One process, the standard `#[tokio::main]` multi-threaded runtime.

| | |
|---|---|
| Versions | Rust 1.90.0 (`rust-toolchain.toml`, image `rust:1.90.0-slim-bookworm`), `leptos` 0.8.22, `leptos_meta` 0.8.7, `leptos_router` 0.8.17, `leptos_axum` 0.8.10, `axum` 0.8.9, `tokio` 1.53.2, `reqwest` 0.13.5 (no default features: HTTP/1, no TLS), `serde` 1.0.229, `serde_json` 1.0.151, `time` 0.3.55, `hmac` 0.12.1, `sha2` 0.10.9, `base64` 0.22.1, `wasm-bindgen` 0.2.129 (exact `=` pins in `Cargo.toml`, `Cargo.lock` committed) |
| Build tool | `cargo-leptos` 0.3.11 (prebuilt release binary); it downloads the matching `wasm-bindgen` CLI 0.2.129 and binaryen `wasm-opt` version_123 |
| Server binary | `ssr` feature, `release` profile (opt-level 3, LTO fat, codegen-units 1, panic abort, same as `../rust-axum`) |
| Client bundle | `hydrate` feature, `wasm-release` profile (opt-level z): `/pkg/feed-leptos.js` 24 KB + `/pkg/feed-leptos.wasm` 689 KB (uncompressed) |
| Runtime image | `debian:bookworm-slim` + `curl`, `iproute2`; ~99 MB |
| Memory | ~9 MB RSS after a 60 s / 300-VU load check |

## Files

| Piece | File | Notes |
|---|---|---|
| Server startup, JSON passthroughs, Origin check | `src/main.rs` | `leptos_routes` for the pages + server fns, `/api/posts` and `/api/posts/{id}/like`, `file_and_error_handler` fallback |
| App, pages, server functions | `src/app.rs` | `shell`, `App` (router), `FeedPage`, `PostPage`, `LoginPage`, `PostCard`, `Compose`, `NotFound` |
| Hydration entry | `src/lib.rs` | `hydrate()` (WASM only) |
| API client (one shared `reqwest::Client`, uncached) | `src/api.rs` | same as `../rust-axum` |
| Demo login token + cookie reading | `src/session.rs` | same HS256 token as the other variants |
| Date text | `src/date.rs` | `Dec 31, 2025, 11:59 PM UTC` |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`, served as `/styles.css` (assets-dir, not run through cargo-leptos' style pipeline) |

## How rendering works

Each page is a `<Route>` whose component creates a `Resource` that calls a `#[server]` function (`get_feed`,
`get_post`, plus `get_username` for the header). During SSR the server function runs in-process (no HTTP hop) and
calls the API; on the client it would be a `POST /api/<name><hash>`.

**All routes use `SsrMode::Async`**: the server waits for every resource on the page, then renders the whole document
in one go, so the posts sit in place inside `<section class="feed">` and a missing post can answer a real **404**
(API failure: **500**). Leptos' default (out-of-order streaming) would send the shell first and the 20 posts later as
`<template>` chunks after `</html>`, moved into place by inline JS; that markup would not match the other variants.
The response body is still a stream (`transfer-encoding: chunked`, no `content-length`).

Feed page size: the API's 20 posts. Payload: feed ~15.7 KB, post page ~2.2 KB. Compared to `../rust-axum`
(~10.5 KB / ~1.0 KB) the extra bytes are hydration data: the resources' JSON serialized into a `<script>` (so the
client does not refetch), the hydration bootstrap script, `modulepreload`/`preload` links for the JS/WASM, and
`<!>` / `<!--…-->` hydration markers in the text (e.g. `@<!>name`, `#<!>123`). After stripping comments and markers
and ignoring attribute order, `<main>` matches `../express` except the form `action`s (see below).

## Mutations (likes, new posts, sign-in)

Idiomatic Leptos: `<ActionForm>` bound to a `ServerAction` (`like_post`, `create_post`, `login`). The markup is a plain
`<form method="post" action="/api/like_post<hash>">` (instead of `/actions/like`), so it works without JS:

- With JS (hydrated) the form is submitted with `fetch`, and the pages' resources refetch when the action completes.
- Without JS, `leptos_axum` answers a browser form post (`Accept: text/html`) with **302** back to the `Referer`
  (Post/Redirect/Get); a server-fn error comes back as `?__err=…` and is shown under the compose box (`body is required`).
  `login` sets the `token` cookie (`HttpOnly; SameSite=Lax; Path=/`) and redirects to `/`; like/create without a
  cookie redirect to `/login`. (A non-browser client without `Accept: text/html` gets `200`/`500` plus a `Location`
  header instead of a 3xx.)

**Origin check.** Leptos server functions have no CSRF protection of their own, so `src/main.rs` adds a middleware with
the same rule as `../rust-axum` and `../express`: on a POST (other than `/api/posts*`), if an `Origin` header is
present its `host[:port]` must equal `Host`, otherwise **403**. Requests without `Origin` pass.

`POST /api/posts` and `POST /api/posts/{id}/like` are the JSON passthroughs from the spec (Authorization forwarded
as-is, API status + body returned unchanged, invalid JSON → 400 `{"error":"malformed JSON body"}`), as plain Axum
routes next to the Leptos routes. Unknown paths: static file from the site root if it exists, else the app's 404 page.

## Concurrency model

Same as `../rust-axum`: Tokio multi-threaded runtime, workers = `available_parallelism()` (cgroup-aware: **1 worker**
under `--cpus 0.4`; logged on startup), one shared `reqwest` pool to the API, `TCP_NODELAY` on accepted sockets.
Leptos' reactive system runs per request inside an `Owner`; Async mode buffers the page before sending.

## Build and run

```bash
cargo install cargo-leptos --version 0.3.11 --locked   # or the prebuilt binary from its GitHub release
cargo leptos build --release                           # target/release/feed-leptos + target/site/{pkg,styles.css}
LEPTOS_SITE_ROOT=target/site LEPTOS_OUTPUT_NAME=feed-leptos HOST=127.0.0.1 PORT=3000 \
  BACKEND_URL=http://127.0.0.1:4000 ./target/release/feed-leptos
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`/`PORT`
(default `127.0.0.1:3000`; they override `LEPTOS_SITE_ADDR`), `LEPTOS_SITE_ROOT`, `LEPTOS_OUTPUT_NAME`.

The Dockerfile builds in `rust:1.90.0-slim-bookworm` (adds the `wasm32-unknown-unknown` target, downloads
`cargo-leptos`, fetches crates in their own layer, then `cargo leptos build --release` with `CARGO_BUILD_JOBS=4`;
~2-3 min) and runs on `debian:bookworm-slim` with the binary, `site/` and only `curl` + `iproute2` added. It applies the
optional `NET_DELAY` with `tc netem`, listens on `0.0.0.0:3000`, and has the same `curl` healthcheck as the other
variants. `.dockerignore` excludes the local `target/` (several GB).
