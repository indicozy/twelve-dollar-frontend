# aspnet-tuned: `../aspnet` with container-tuned .NET runtime settings (same app code, same markup)

Identical to `../aspnet` (ASP.NET Core Razor Pages on .NET 10, Kestrel, no caching) except for four runtime/publish
settings aimed at a 1-vCPU container with a 0.4 CPU quota. Nothing about rendering, data or caching changes; the rendered
`/` and `/posts/1` are byte-identical to `../aspnet` apart from the per-request antiforgery token.

## Tuning (what differs from `../aspnet`)

| Setting | Where | Why |
|---|---|---|
| `DOTNET_ThreadPool_UnfairSemaphoreSpinLimit=0` | `Dockerfile` (`ENV`) | An idle thread-pool worker spins (calling `sched_yield`) before it blocks, waiting for new work. On one CPU with a 40% quota that spin is pure waste and it eats quota that requests need later in the same 100 ms CFS period. `perf` of `../aspnet` at 3,000 users: **19%** of the container's CPU samples were `LowLevelLifoSemaphore.Wait` spinning/yielding; with the limit at 0 it is **7.5%** (what remains is the futex wake/sleep itself) and the same 30 s window took 13.5% fewer samples. |
| `PublishReadyToRun` (+ `RuntimeIdentifier=linux-x64`, framework-dependent) | `Feed.csproj` | The framework assemblies are already ReadyToRun; this precompiles `Feed.dll` (incl. the generated Razor view classes) too, so a fresh container starts from native code instead of Tier-0 JIT. Tiered compilation and dynamic PGO stay on (turning tiering off made it much worse: 1.35 ms/request, because R2R code is then never re-jitted). |
| `ConcurrentGarbageCollection=false` | `Feed.csproj` | With one CPU the runtime already uses workstation GC (`Feed.runtimeconfig.json` still says `System.GC.Server: true`, ignored on 1 CPU); this also drops the background-GC thread. Gen0 GCs at this load are ~2/s, so this is minor. |
| `InvariantGlobalization=true` | `Feed.csproj` | Every date/number format in the app already uses `CultureInfo.InvariantCulture`; skips loading ICU (memory, startup). |

What was measured and **not** changed: `DOTNET_TieredPGO=0` (slower: 0.87 ms/request), `DOTNET_TieredCompilation=0`
(1.35 ms/request), `DOTNET_GCgen0size=64MB` (no CPU change, +50 MB). `DOTNET_PROCESSOR_COUNT`/`DOTNET_GCHeapCount`
are moot: with `--cpus 0.4` (and the sim's single-CPU cpuset) the runtime already sees `ProcessorCount=1`
(`dotnet-counters`: `dotnet.process.cpu.count = 1`), so server GC is off and the pool's minimum is 1 thread.

Antiforgery (kept, as in `../aspnet`) is the next-largest avoidable cost: about **11-12%** of CPU samples are
Data Protection (`libcrypto` AES/HMAC) for the antiforgery tokens, and the tokens are 28% of the feed page's bytes. The
JS variants use an `Origin` check instead. It is left on here because it is a security default, not a runtime knob.

Measurements: `../../research/anomalies-nonjs.md`.

---

*The rest of this README is `../aspnet`'s, unchanged except where it says `aspnet-tuned`.*

## Original README: aspnet — ASP.NET Core Razor Pages (.NET 10 LTS, Kestrel), server-rendered, no caching

The ASP.NET Core version of `../sveltekit` and `../astro`: same pages, markup and CSS (`../SPEC.md`,
`../shared/styles.css`). Every page is rendered on every request from a fresh API call, in one Kestrel process
(`dotnet Feed.dll`). Plain Razor Pages with tag helpers: **no client JS at all** (the template's Bootstrap, jQuery,
validation scripts, `site.css`/`site.js`, favicon, Privacy and Error pages were removed).

Versions: .NET **10.0.12** runtime / ASP.NET Core 10.0.12, SDK **10.0.401** (`global.json`, `rollForward: latestPatch`),
`TargetFramework` `net10.0`, no NuGet packages. Images: `mcr.microsoft.com/dotnet/sdk:10.0.401` (build) and
`mcr.microsoft.com/dotnet/aspnet:10.0.12` (runtime, Ubuntu 24.04).
Why 10: as of October 2026 it is the newest *stable* release (LTS, supported until November 2028). .NET 11 is only at
RC1 (GA is due in November 2026), and .NET 9 (STS) and 8 (LTS) both reach end of support in November 2026.

| Piece | File | Notes |
|---|---|---|
| Startup, Kestrel URL, JSON pass-through, 404 fallback | `Program.cs` | `HOST`/`PORT` → `UseUrls("http://HOST:PORT")` |
| API client (typed `HttpClient` from `IHttpClientFactory`, uncached) | `Api.cs` | same functions as the JS variants; System.Text.Json source generation (snake_case); `Dates.Format` |
| Demo login token + cookie reading | `Session.cs` | HS256, same header/payload JSON as `sveltekit/src/lib/server/session.ts` |
| Layout, header with `@username` | `Pages/Shared/_Layout.cshtml` | reads the `token` cookie on every request |
| Post card | `Pages/Shared/_PostCard.cshtml` | partial; `<form method="post" asp-page-handler="Like">` |
| Like handler + 303 helper | `Pages/FeedPageModel.cs` | base class of the feed and post pages |
| Feed `/` | `Pages/Index.cshtml(.cs)` | `OnGetAsync` → `GET /feed`; `OnPostCreateAsync`, `OnPostLikeAsync` |
| Post `/posts/{id}` | `Pages/Post.cshtml(.cs)` | missing/invalid id → status 404 + the not-found markup |
| Login `/login` | `Pages/Login.cshtml(.cs)` | `OnPost` signs the token, sets the httpOnly cookie, 303 to `/` |
| 404 page | `Pages/NotFound.cshtml`, `Pages/Shared/_NotFound.cshtml` | unknown paths via `MapFallbackToPage("{*path}", "/NotFound")` |
| Stylesheet | `wwwroot/styles.css` | verbatim copy of `../shared/styles.css` |
| Config | `appsettings.json` | template logging, plus `System.Net.Http.HttpClient: Warning` (see below) |

Env: `BACKEND_URL` (default `http://127.0.0.1:4000`), `JWT_SECRET` (default `twelve-dollar-challenge`), `HOST`
(default `127.0.0.1`; `0.0.0.0` in the image), `PORT` (default `3000`), `ASPNETCORE_ENVIRONMENT=Production` in the image.

## How it renders

- **Compiled views.** At build time the Razor SDK's source generator turns each `.cshtml` into a C# class
  (`Feed.dll`); there is no runtime compilation. A page's generated `ExecuteAsync` is a straight sequence of
  `WriteLiteral("<article class=\"post\" data-post-id=\"")`, `Write(post.Id)` (HTML-encoded) and tag-helper calls.
- **Request flow.** Endpoint routing picks the page, model binding fills handler parameters, the page model's
  `OnGetAsync` awaits the API (async `HttpClient`, no thread blocked), then the page, its partials and the layout render.
- **Buffered, not streamed.** The page body is rendered into a pooled `ViewBuffer` first (the layout needs it for
  `RenderBody()`), then the whole document is written through a pooled UTF-8 `HttpResponseStreamWriter` and flushed
  at the end. Nothing reaches the client before the API call has returned, so a missing post is a real 404. Kestrel
  sends it with `Transfer-Encoding: chunked` (no `Content-Length`). There is no skeleton/fallback, like SvelteKit and
  Astro, unlike Next.js.
- **Tag helpers** do three things here: `asp-page-handler` builds the form `action` (`/?handler=Like`,
  `/posts/250000?handler=Like`), the form tag helper adds the antiforgery hidden field, and `href="~/styles.css"` is
  rewritten to the fingerprinted URL from `MapStaticAssets` (`/styles.<hash>.css`).
- **Encoding.** `@expr` output goes through the default `HtmlEncoder`, which also encodes non-ASCII and some ASCII
  characters (`é` → `&#xE9;`, `'` → `&#x27;`). The seeded data is ASCII, so the bytes match the JS variants there.
- **Dates.** `Dates.Format` parses `created_at` as UTC and prints `MMM d, yyyy, h:mm tt` with the invariant culture plus
  ` UTC`, which matches `Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })`
  byte for byte (checked against Node for midnight, noon, 1-digit days/hours). `datetime` is the raw string.

## Mutations (Post/Redirect/Get)

- Like and create are Razor Pages **named handlers** posted by plain HTML forms. Each forwards
  `Authorization: Bearer <token cookie>` to the API, then answers **303** (`Location` header + `StatusCodeResult(303)`,
  since `RedirectResult` only does 301/302/307/308): back to the same page, or to `/login` with no token cookie.
- A rejected post (e.g. empty body) re-renders the feed with the API's error (`body is required`) and the API's status
  (400), like the other variants.
- `POST /api/posts` and `POST /api/posts/{id}/like` are **minimal API** endpoints: they forward the incoming
  `Authorization` header as-is (or none) and return the API's status and JSON bytes unchanged (`application/json`).
  `/api/posts` parses the request body with `JsonDocument` and sends `{"body": ...}`; invalid JSON → 400
  `{"error":"malformed JSON body"}`. They bind no form data, so antiforgery doesn't apply to them.

## Antiforgery (framework default, kept)

Razor Pages validates an antiforgery token on every unsafe-method page request. It works cleanly: the form tag helper
puts a hidden `__RequestVerificationToken` into each `<form method="post">`, and posting without it gets a 400. What
it costs, measured:

- **Cookie on GET pages with forms** (`/`, `/posts/:id`, `/login`; not the 404 page): `Set-Cookie:
  .AspNetCore.Antiforgery.<hash>=...; path=/; samesite=strict; httponly`, only when the request has no valid cookie
  yet. k6 keeps a cookie jar per VU, so each VU gets it once.
- **Extra headers** on those pages: `Cache-Control: no-cache, no-store`, `Pragma: no-cache`, `X-Frame-Options: SAMEORIGIN`.
- **Bytes:** one request token is generated per response and repeated in every form: 21 forms on the feed page =
  **4,641 of its 16,416 bytes** (28%); 221 bytes on the post page.
- **CPU:** per page, one Data Protection *unprotect* (reading the cookie token) and one *protect* (the request token,
  AES-CBC + HMAC-SHA256), plus one more *protect* for a new visitor's cookie. Small next to the render, but not zero.
  Nothing else is stateful: the tokens hold no server-side session.
- **Keys:** Data Protection generates its key ring at startup and logs two warnings in a container (keys stored in
  `~/.aspnet/DataProtection-Keys`, not persisted, not encrypted). After a restart, old antiforgery cookies are silently
  replaced on the next GET; a form loaded before the restart fails with 400 once.

The JS variants protect forms with an `Origin`/`Sec-Fetch-Site` check instead, which costs no bytes. I kept the
ASP.NET default because it is what a stock Razor Pages app ships; switching it off (`IgnoreAntiforgeryToken`) would save
the 4.6 KB and the two crypto operations per page.

## Process, threads, GC

- One process, Kestrel only (no reverse proxy). Kestrel's socket transport does async I/O; request work runs on the
  .NET thread pool. Kestrel and thread-pool settings are defaults. About 16–20 threads exist when idle.
- `Microsoft.NET.Sdk.Web` sets `System.GC.Server: true` (see `Feed.runtimeconfig.json`). On a 0.4–1 vCPU container the
  runtime reports `Environment.ProcessorCount` = 1 (it rounds the CFS quota up to one CPU), and with a single CPU it
  uses **workstation (concurrent) GC** despite the server-GC setting. Verified in the runtime image with `--cpus 1` and
  `--cpus 0.4`: `ProcessorCount=1`, `GCSettings.IsServerGC=false`; with 4 CPUs it is `true`. The thread pool's minimum
  is then 1 worker thread; above that, hill climbing and starvation detection add threads gradually if work blocks.
  Nothing here blocks: all I/O is awaited. With more CPUs, server GC uses DATAS (on by default since .NET 9), which
  sizes the number of heaps to the load. The GC heap hard limit defaults to 75% of the container memory limit.
- No response compression (ASP.NET Core doesn't compress unless you add `AddResponseCompression`; verified: no
  `Content-Encoding` on HTML with `Accept-Encoding: gzip, br`). The only compression is the static stylesheet:
  `MapStaticAssets` serves build-time gzip/brotli copies (`styles.css` 3,789 B, 1,150 B with brotli), with an ETag and
  `max-age=31536000, immutable` on the fingerprinted URL.
- No output caching, response caching or in-memory caches. `IHttpClientFactory` pools connections to the API
  (keep-alive); that is connection reuse, not data caching.
- `System.Net.Http.HttpClient` logging is set to `Warning`. At the template's `Information` default, `IHttpClientFactory`
  writes four console log lines per API call, which no other variant does.

## Differences from the JS variants

- **Zero JS, no hydration.** Like Astro: no scripts, no embedded data. Forms are plain HTML posts with full-page redirects.
- **Payload.** Feed page 16.4 KB (11.8 KB without the antiforgery fields), post page 1.4 KB, login 1.2 KB, 404 0.7 KB.
  The CSS is a separate file (like SvelteKit and Next.js), not inlined (Astro inlines it).
- **Headers.** `Content-Type: text/html; charset=utf-8`, `Transfer-Encoding: chunked`, `Server: Kestrel`. No ETag,
  no 304. Plus the antiforgery headers and cookie above.
- **404s** are real (status 404 with the header and the not-found markup) for missing/invalid posts and unknown paths.
  Razor Pages also maps `/Index` to the feed, and the 404 page answers on `/404`.
- **No origin check** on form posts (the antiforgery token does that job).

## Build and run

```bash
# Build/publish with the official SDK image (no local SDK needed)
docker run --rm --user $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/src -w /src \
  mcr.microsoft.com/dotnet/sdk:10.0.401 dotnet publish -c Release -o bin/publish

# Run the framework-dependent output on the runtime image
docker run --rm --network host -e ASPNETCORE_HTTP_PORTS= -e HOST=127.0.0.1 -e PORT=3000 \
  -e BACKEND_URL=http://127.0.0.1:4000 -v "$PWD/bin/publish":/app mcr.microsoft.com/dotnet/aspnet:10.0.12 dotnet /app/Feed.dll

# With a local .NET 10 SDK
dotnet publish -c Release -o bin/publish && HOST=127.0.0.1 PORT=3000 dotnet bin/publish/Feed.dll
```

The `Dockerfile` publishes Release on `sdk:10.0.401`, copies the output (about 260 KB, including the `.pdb` and the
compressed CSS) onto `aspnet:10.0.12`, installs `iproute2` (for `NET_DELAY` via `tc netem`) and `curl` (healthcheck),
clears the base image's `ASPNETCORE_HTTP_PORTS=8080`, and listens on `0.0.0.0:3000`.
