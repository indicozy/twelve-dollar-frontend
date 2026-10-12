# phoenix: Phoenix 1.8 + HEEx dead views, server-rendered on every request, no caching

The same app as `../express` (routes, markup, forms, `/actions/*` and `/api/*` routes, 404 page) on Elixir's Phoenix.
Pages are **dead views**: plain controllers render HEEx templates and function components (`Phoenix.Component`)
into a full HTML response. There is no LiveView, no websocket and no `<script>`. Every page request calls the API
with Req and renders fresh HTML. There's no Ecto and no database.

| | |
|---|---|
| Versions | Elixir **1.20.4**, Erlang/OTP **29.1.1** (`hexpm/elixir:1.20.4-erlang-29.1.1-debian-bookworm-20261005-slim` build, `debian:bookworm-20261005-slim` runtime) |
| Packages | phoenix **1.8.15**, phoenix_html 4.3.0, phoenix_live_view 1.2.12 (only for `Phoenix.Component`/HEEx), bandit **1.12.5** (the 1.8 generator default; no Cowboy), req **0.7.5** (finch 0.24.0, mint 1.11.0), jason 1.4.5, plug 1.20.3 (exact pins in `mix.exs`, `mix.lock` committed) |
| Server | `mix release` (`bin/feed start`), `MIX_ENV=prod`, `PHX_SERVER=true`, Bandit on `0.0.0.0:3000` |
| Templates | `lib/feed_web/components/layouts/root.html.heex` (root layout: head, top bar), `controllers/page_html/{index,show,login,not_found}.html.heex`, the post card is the `<.post>` function component in `components/post_components.ex` |
| Controllers | `PageController` (pages, login), `ActionController` (form posts, 303), `ApiController` (JSON passthrough) |
| API client | `lib/feed/api.ex`: Req on its default Finch pool (`Req.Finch`, pooled keep-alive HTTP/1 connections), `retry: false` |
| Feed page | about 13.1 KB (Express: 10.5–12 KB). The 21 hidden CSRF inputs add about 1.9 KB. Post page about 1.2 KB |

## How it renders

On each request, Bandit runs the endpoint plugs: `Plug.Static` (`only: ["styles.css"]`, a list check with no `fs.stat`),
`RequestId`, `Telemetry`, `Plug.Parsers` (urlencoded only), `MethodOverride`, `Head`, and `Plug.Session`. Then the
router's `:browser` pipeline runs: `accepts`, `fetch_session`, `put_root_layout`, `protect_from_forgery`,
`put_secure_browser_headers`, and `assign_user`, which reads the `token` cookie and decodes the JWT payload into
`@username`. The controller then makes one Req call and runs `render/3`.

- **HEEx compiles to Elixir code when the project compiles**, not when it runs. Each template is a function that
  returns iodata: static chunks are shared literals, and dynamic values are HTML-escaped (`&amp; &lt; &gt; &quot; &#39;`).
  The post card is a function component called 20 times on the feed. The response body is the iodata list, written
  to the socket without first being joined into one binary.
- **Not streamed.** The whole page is rendered before it's sent, with `content-length` set, so a missing post gets a
  real 404 (`/posts/:id` with API 400/404, and any unknown GET path through the `/*path` route).
- **No ETag** (Phoenix doesn't add one). Headers: `cache-control: max-age=0, private, must-revalidate` and the
  `put_secure_browser_headers` set (`content-security-policy: base-uri 'self'; frame-ancestors 'self';`,
  `x-content-type-options`, `x-permitted-cross-domain-policies`, `referrer-policy`), plus `x-request-id`.
- **Compression is on.** Bandit's default (`http_options: [compress: true]`) gzips or deflates the response when the
  client sends `Accept-Encoding`. The feed page goes from 13.1 KB to 1.7 KB gzipped, and responses get
  `vary: accept-encoding`. k6 (Go's HTTP client) sends `Accept-Encoding: gzip`, so the benchmark gets compressed pages,
  unlike Express. Turning it off (`compress: false`, as a test build) gave 1.82 and 1.68 ms of CPU per request against
  1.61–1.70 ms with it on, so on this page size the cost is within the noise. The default stays.
- **Logging.** Phoenix logs every request at `:info`. `config/prod.exs` sets the logger to `:warning`, so there's no
  per-request log line, matching the other variants.

## Sessions and CSRF (Phoenix's defaults)

The forms use `<.form for={%{}} action=...>`, which adds Phoenix's hidden `_csrf_token` input. The `:browser`
pipeline's `protect_from_forgery` (`Plug.CSRFProtection`) checks that token on every POST and returns **403** if it's
missing or wrong. The token is kept in Phoenix's default **cookie session** (`_feed_key`). That cookie is signed with
`secret_key_base`, not encrypted, and set with `SameSite=Lax; HttpOnly`. So:

- When a client has no session yet, the page response sets `_feed_key` (about 150 bytes). k6 keeps cookies per VU, so
  only a VU's first page gets that `Set-Cookie`. Every request with the cookie pays for one HMAC check of it.
- Each page masks the token once, and all 21 forms on the feed reuse the same masked value.
- Phoenix doesn't check `Origin` for plain HTTP requests (its `check_origin` applies only to sockets). The CSRF token
  replaces the Express/Flask/Rust variants' Origin rule.
- The demo JWT still lives in its own `token` cookie (`/login` sets it with `Path=/; HttpOnly; SameSite=Lax`), like
  the other variants. The session holds only the CSRF token.
- `SECRET_KEY_BASE` falls back to a fixed demo value, because the container contract passes only `BACKEND_URL` and
  `JWT_SECRET`. Set it in a real deployment.
- The `/api/*` routes use the `:api` pipeline: no session, no CSRF. `/api/posts` reads the raw body
  (`Plug.Parsers` only handles urlencoded) and parses it strictly with Jason. Invalid JSON, an empty body or `null`
  returns 400 `{"error":"malformed JSON body"}`. The API's status and body bytes are returned unchanged.

## Process model and BEAM schedulers

There is one OS process: the BEAM. Inside it, Bandit (Thousand Island) runs one Erlang process per connection, and
requests run in parallel on the BEAM schedulers. The BEAM sees the **host's cores** (20 logical CPUs here), so it
creates 20 schedulers. The container's cgroup limits it to **0.4 CPU**, and OTP reads that quota (`cpu.max`) at boot and
sets **schedulers online to ceil(0.4) = 1** (and 1 dirty CPU scheduler). `rel/vm.args.eex` keeps the defaults.

Measured with a 300-VU, 60 s `bench/ssr-load.js` run per row, `--cpus 0.4`. CPU is cgroup `usage_usec` divided by the
k6 request count:

| BEAM flags | schedulers / online | CPU per request | p95 | errors |
|---|---|---|---|---|
| default (kept) | 20 / 1 | **1.61, 1.61, 1.70 ms** (3 runs) | 3.0–3.4 ms | 0% |
| `ERL_FLAGS="+S 1"` | 1 / 1 | 1.77, 1.82 ms (2 runs) | 3.5–4.2 ms | 0% |
| `ERL_FLAGS="+S 20:20"` (ignore the quota) | 20 / 20 | 6.20 ms (1 run) | 5.2 ms, p99 45 ms | 0.38% (resets right after start) |

`+S 1` doesn't help, so the default stays. The default already runs one online scheduler because OTP respects the
cgroup quota. Forcing every host core online costs about 4x the CPU per request, because idle schedulers spin and
wake each other up.

## Build and run

```bash
mix deps.get && MIX_ENV=prod mix release
PHX_SERVER=true HOST=127.0.0.1 PORT=3000 BACKEND_URL=http://127.0.0.1:4000 JWT_SECRET=twelve-dollar-challenge \
  _build/prod/rel/feed/bin/feed start
```

Env: `BACKEND_URL`, `JWT_SECRET`, `HOST`/`PORT` (defaults `127.0.0.1:3000`; the Dockerfile sets `0.0.0.0:3000`),
`SECRET_KEY_BASE` (optional), `ERL_FLAGS` (optional VM flags).

The Dockerfile has two stages, shaped like `mix phx.gen.release --docker`. The build stage runs `mix deps.get --only
prod`, `deps.compile` and `mix release` (the release bundles ERTS). The runtime stage is Debian slim plus
`iproute2`, `curl` (for the healthcheck) and `libsctp1` (which silences OTP's socket NIF warning). The image is
about 142 MB. Unlike the generator, it runs as root so the `NET_DELAY` `tc` line works. CMD is `exec /app/bin/feed start`,
and SIGTERM stops the release cleanly.

## Differences from the reference markup

- Every `<form>` has an extra `<input name="_csrf_token" type="hidden" hidden value="...">` as its first child.
- HEEx escapes `"` as `&quot;` (EJS uses `&#34;`). Attribute order is `action` then `method` (Phoenix's `<.form>`).
  Otherwise the output matches `../express` once whitespace is ignored (checked on `/`, `/posts/1`, `/login`, 404).
- Compiling prints one HEEx warning: `name="id"` on an input "overrides the ID of the form element" (DOM clobbering
  of `form.id`). It's harmless here because the spec requires the field name `id`.
- Unknown **POST** paths raise `NoRouteError` and return a plain-text `Not Found` 404 (unknown GETs get the full 404 page).
