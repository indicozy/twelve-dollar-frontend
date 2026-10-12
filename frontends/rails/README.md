# rails: Ruby on Rails 8.1 + ERB on Puma, server-rendered on every request, no caching

The Ruby variant. It has the same pages, markup, classes and CSS as `../express` and `../django` (`../SPEC.md`,
`../shared/styles.css`). Every page request calls the API and renders fresh HTML from ERB views and partials. Nothing is
cached. The app was generated with `rails new` (no Active Record and no other unused frameworks) and keeps Rails'
standard production setup: the generated Dockerfile, `RAILS_ENV=production`, `eager_load`, bootsnap, jemalloc, YJIT,
and Puma with the generated `config/puma.rb`. **The pages ship zero JS**: likes, new posts and sign-in are plain HTML
forms that carry Rails' CSRF token and get a `303` back (Post/Redirect/Get).

| | |
|---|---|
| Ruby | **4.0.7** (`ruby:4.0.7-slim-trixie`). Ruby "3.5" was released as 4.0 (Dec 2025), so 4.0.x is the current stable line. The process reports `+YJIT +PRISM` |
| Rails | **8.1.4** (rubygems `latest`). `config.load_defaults 8.1` |
| Puma | **8.0.2** |
| bootsnap | **1.26.0** |
| Other gems | exact versions in `Gemfile.lock` (Bundler 4.0.20, platforms `x86_64-linux(-gnu)`): rack 3.2.7, erubi 1.13.1, json 3.0.2, ... |
| Database | none. `active_record/railtie` is not required, there is no `config/database.yml` and nothing opens a DB |
| HTTP client | `Net::HTTP` from the standard library, one persistent keep-alive connection per Puma thread (`lib/feed_api.rb`) |
| Feed page | ~14.0 KB (Express: 10.5 to 12 KB). The 21 hidden `authenticity_token` inputs add about 2.4 KB. Post page ~1.2 KB |

Generated with `rails new feed --skip-active-record --skip-javascript --skip-asset-pipeline --skip-hotwire
--skip-jbuilder --skip-action-mailer --skip-action-mailbox --skip-action-text --skip-active-job --skip-active-storage
--skip-action-cable --skip-solid --skip-kamal --skip-thruster --skip-test --skip-system-test ...`, then trimmed: PWA
files, icons, the CSP initializer (it was all commented out), credentials, `bin/setup`/`bin/dev`/`bin/ci` and the
`debug` gem. The `Gemfile` keeps the `rails` meta-gem (the default), so the unused frameworks are installed in the
image but never loaded. `config/application.rb` only requires `active_model`, `action_controller` and `action_view`.

| Piece | File | Notes |
|---|---|---|
| Routes | `config/routes.rb` | `scope format: false`; a catch-all `match "*path"` renders the 404 page |
| Feed `/`, compose, like | `app/controllers/feed_controller.rb` | `before_action :require_token` on the form posts; `redirect_back_or_to` after a like |
| Post `/posts/:id` | `app/controllers/posts_controller.rb` | API 404/400 → the 404 page with status 404 |
| Login | `app/controllers/sessions_controller.rb`, `app/views/sessions/new.html.erb` | signs the demo JWT and sets the `token` cookie |
| 404 + helpers shared by pages | `app/controllers/application_controller.rb` | `current_username` (from the `token` cookie), `not_found` |
| JSON passthrough | `app/controllers/api/posts_controller.rb` | `ActionController::API`: no CSRF, no cookies; `wrap_parameters false` |
| API client | `lib/feed_api.rb` | `feed`, `post`, `create_post`, `like_post`; `ERB::Util.url_encode` for ids |
| Demo token | `lib/demo_token.rb` | same HS256 header/payload as `sveltekit/src/lib/server/session.ts` (`OpenSSL::HMAC`) |
| Date text | `app/helpers/application_helper.rb` | `Time.iso8601(..).utc.strftime("%b %-d, %Y, %-l:%M %p UTC")` = `Dec 31, 2025, 11:59 PM UTC` |
| Layout (header with `@username` or "Sign in") | `app/views/layouts/application.html.erb` | |
| Post card | `app/views/posts/_post.html.erb` | partial, rendered on the feed as a **collection** (`render partial:, collection: @posts, locals: { link: true }`) |
| Pages | `app/views/feed/index.html.erb`, `posts/show.html.erb`, `application/not_found.html.erb` | |
| Production settings | `config/environments/production.rb` | the generated file, with `force_ssl`/`assume_ssl` off (see below) |
| Puma | `config/puma.rb` | unchanged from the generator |
| Stylesheet | `public/styles.css` | verbatim copy of `../shared/styles.css`, served by `ActionDispatch::Static` |

## Routes

| Route | What it does |
|---|---|
| `GET /` | `GET {BACKEND_URL}/feed`, renders header, compose form (with the `?error=` message if any), "Latest", 20 posts |
| `GET /posts/:id` | `GET {BACKEND_URL}/posts/:id`; API 404/400 (and ids with a `.`, which the route does not match) → the 404 page, status **404** |
| `GET /login` | the sign-in form |
| `POST /login` | form → signs `{"sub":"<id>","username":"<name>","iat":..,"exp":..+7d}` with `JWT_SECRET`, sets `token` (`path=/; httponly; samesite=lax`), 303 to `/` (bad input → `/login?error=1`) |
| `POST /actions/like` | form (`id`) → `POST /posts/:id/like` with `Authorization: Bearer <token cookie>`, 303 back to the Referer (same host only, else `/`) |
| `POST /actions/create` | form (`body`) → `POST /posts`; 303 to `/`, or to `/?error=<API message>` |
| `POST /api/posts` | JSON passthrough: strict `JSON.parse(request.raw_post)`; invalid JSON, empty body or `null` → 400 `{"error":"malformed JSON body"}`; sends `{"body": ...}` |
| `POST /api/posts/:id/like` | JSON passthrough |
| `GET /styles.css` | `ActionDispatch::Static` (public/) |
| anything else (any method) | the 404 page, status 404 (header still shows the signed-in user) |

Form posts without a `token` cookie redirect to `/login`. The JSON routes forward the incoming `Authorization` header
as-is (or none) and return the API's status and body bytes unchanged (`application/json; charset=utf-8`). If the API
is down or returns an unexpected status on a page, the exception becomes a plain 500 (`public/500.html`).

## Sessions and CSRF (Rails' defaults)

The forms are built with `form_with url: ...`, which adds a hidden `authenticity_token` input. `ActionController::Base`
has `protect_from_forgery with: :exception` by default. The token's secret is stored in the session, and the session
uses Rails' default **cookie store**: the session is encrypted into the `_feed_session` cookie, with no server-side
storage and no DB. `SECRET_KEY_BASE` comes from the environment. The Dockerfile sets a public benchmark-only value
instead of using `credentials.yml.enc` + `RAILS_MASTER_KEY`. What this costs per page:

- **Per-form tokens** (`per_form_csrf_tokens`, the default since Rails 5): each form gets its own masked token bound
  to its action URL. That is 21 HMAC + mask + base64 computations on the feed page, about 2.4 KB of HTML.
- **Origin check** (`forgery_protection_origin_check`, the default): if `Origin` is present it must equal the
  request's base URL. A mismatch, or a missing or wrong token, is a **422** (`public/422.html`). This is stricter than
  Express's Origin-only rule: curl or k6 form posts need the token from the page they came from.
- **Every page response carries `Set-Cookie: _feed_session=...`** (about 300 bytes, re-encrypted with AES-256-GCM).
  This happens on the first visit and also when the browser already sends the cookie. The 404 page for unknown paths
  sets it too, because it renders the layout through a controller.
- The `token` cookie holds the raw JWT, unsigned and unencrypted, like the other variants, so the seed tokens work.
  The header reads the username from its payload (not verified).
- The `/api/*` routes use `ActionController::API`, so they have no forgery protection. The session is lazy, so
  they send no cookies.

## How it renders

Per request: Puma reads the request on its reactor thread and hands it to one of its 3 threads. Then the Rails
middleware stack runs. These are all defaults: `Rack::Sendfile`, `ActionDispatch::Static` (a file lookup in `public/`
for every path), `Executor`, `Rack::Runtime`, `MethodOverride`, `RequestId`, `RemoteIp`, the request logger, exception
handling, `Callbacks`, `Cookies`, `Session::CookieStore`, `Flash`, the CSP middleware (no policy configured),
`Rack::Head`, `ConditionalGet`, `ETag`, `TempfileReaper`. Next come the router (journey) and the controller's
callbacks (CSRF check on POST, `require_token`). The action makes one `Net::HTTP` call to the API, parses the JSON
with `json` 3.0, and renders.

- **ERB templates are compiled once.** In production (`enable_reloading = false`, `eager_load = true`), Action View
  compiles each `.html.erb` with Erubi into a Ruby method on first use and keeps it. Template lookup results are cached
  too. That caches template *code*, not data or HTML. A render calls the compiled method, which appends literal
  strings and `html_escape`d values (`& < > " '` → `&amp; &lt; &gt; &quot; &#39;`) to an `ActionView::OutputBuffer`.
  YJIT compiles the hot Ruby methods (including the compiled templates) to machine code.
- **The post card is a collection render**: one partial lookup, then the compiled partial runs 20 times. Inside, the
  card uses `form_with` (form tag + per-form CSRF token) and `link_to "#N", post_path(id)` (a route helper), as
  idiomatic Rails would. These helpers are most of the view time.
- **Not streamed.** The full page is built and then sent with `Content-Length`, so a missing post is a real 404.
- **ETag and 304.** The default `Rack::ETag` hashes every 200 HTML body (SHA-256, first 32 hex chars) and sets `ETag: W/"..."` and
  `Cache-Control: max-age=0, private, must-revalidate`. `Rack::ConditionalGet` answers `304` when `If-None-Match`
  matches, but only after the page has been fetched and rendered, so it is not a cache. k6 does not send it.
- **Logging.** Production logs at `info` to STDOUT with the request id tag (the generator default). That is 4 lines per
  request (`Started`, `Processing`, `Rendered layout`, `Completed`). `RAILS_LOG_LEVEL=warn` would turn it off. It was
  left on because it is part of the standard setup and adds some CPU per request.
- **YJIT.** Rails turns YJIT on at boot (`config.yjit`, the default since Rails 7.2 outside development and test), and
  the boot banner shows `+YJIT`. bootsnap caches compiled Ruby bytecode and load paths, which only affects boot time.

## Process model (Puma, Rails 8 defaults)

The generated `config/puma.rb` is kept as is: `threads 3, 3` (`RAILS_MAX_THREADS`, default 3), `port 3000`, the
`tmp_restart` plugin. It has no `workers` line, so Puma reads `WEB_CONCURRENCY`. That variable is unset, so Puma
runs in **single mode: one process (PID 1), no cluster, 3 request threads**, plus Puma's reactor and thread-pool
housekeeping threads. Because of CRuby's GVL, only one thread runs Ruby at a time. The other threads overlap with
waiting on the API. Setting `WEB_CONCURRENCY=2` (or `auto`) would fork workers, but on the simulated 1-vCPU server they
would compete for the same CPU.

- **Start command**: `bin/rails server -b 0.0.0.0 -p 3000` (the generator's CMD; `rails server` binds `0.0.0.0`
  outside development anyway). No Thruster or other proxy in front (`--skip-thruster`).
- **Keep-alive (client side)**: Puma 8 defaults. `persistent_timeout` is 65 s, `max_keep_alive` is 999 requests per
  connection, and `first_data_timeout` is 30 s.
- **Keep-alive (to the API)**: each Puma thread keeps one `Net::HTTP` connection open (`Thread.current`), so 3
  connections in total. `Net::HTTP` reopens the socket if it was idle for more than its `keep_alive_timeout` (2 s,
  the default) or was closed, and it retries idempotent requests once. On any error the thread drops its connection
  and opens a new one on the next call. There are no extra gems (faraday, httpx, net-http-persistent). Default
  timeouts: open 60 s, read 60 s.
- **Memory**: about 130 MB RSS after the load check (jemalloc via `LD_PRELOAD`, as generated).
- `docker stop`: Puma handles SIGTERM, finishes in-flight requests and exits at once (exit code 1, Puma's default `raise_exception_on_sigterm`).

## Differences from the reference

- **Markup** is the same as Express once whitespace is ignored. The only differences are on the forms, from
  `form_with`: attribute order (`action=... accept-charset="UTF-8" method="post"`) and an extra
  `<input type="hidden" name="authenticity_token" value="..." autocomplete="off" />`. Escaping uses `&quot;`/`&#39;`.
  `data-post-id` and `href="/posts/N"` are identical.
- **After a like**, `redirect_back_or_to` redirects to the full Referer URL, query included, when it is the same
  host. Express keeps only the path.
- **CSRF failures are 422** (Express answers 403 for a bad Origin and has no token).
- Default security headers on every response: `x-frame-options: SAMEORIGIN`, `x-content-type-options: nosniff`,
  `x-xss-protection: 0`, `x-permitted-cross-domain-policies: none`, `referrer-policy: strict-origin-when-cross-origin`.
  Also `x-request-id`, `x-runtime` and `vary: Accept`. No compression.
- Changes to the generated app:
  - `config.force_ssl` and `config.assume_ssl` are `false`: the sim is plain HTTP with no TLS proxy, and
    `force_ssl` would redirect every request to https.
  - The `/up` health route is removed (the healthcheck GETs `/`).
  - `allow_browser versions: :modern` is removed (no other variant gates browsers, and it parses the User-Agent on
    every request).
  - The 1-year `cache-control` for `public/` is removed (`styles.css` is not digest-stamped).
  - The container runs as **root** (the generator adds a `rails` user), because the NET_DELAY `tc` line needs it.

## Build and run

```bash
bundle install
RAILS_ENV=production SECRET_KEY_BASE=$(bin/rails secret) BACKEND_URL=http://127.0.0.1:4000 \
  JWT_SECRET=twelve-dollar-challenge bin/rails server -b 127.0.0.1 -p 3000
```

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`),
`SECRET_KEY_BASE` (required in production; the Dockerfile sets a public benchmark value), `RAILS_MAX_THREADS` (3),
`WEB_CONCURRENCY` (unset = single mode), `RAILS_LOG_LEVEL` (`info`), `NET_DELAY` (Docker only, `tc netem`).

The Dockerfile is the one `rails new` generates (base, build, final stages; `bundle install` with
`BUNDLE_DEPLOYMENT=1`, `BUNDLE_WITHOUT=development`; `bootsnap precompile` for the gems and for `app/` and `lib/`;
jemalloc). It adds `iproute2`, runs as root, applies the optional `NET_DELAY` with `tc netem`, then runs
`exec ./bin/rails server -b 0.0.0.0 -p 3000`. The healthcheck is `curl -fsS http://127.0.0.1:3000/`.
