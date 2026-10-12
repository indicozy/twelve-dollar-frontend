#!/usr/bin/env python3
"""Builds report/analysis.html and report/deck.html from sim/results/results.tsv.

Each page is a template (report/*.template.html) with a `/*__DATA__*/null` placeholder that gets the JSON below.
Per-variant facts that aren't in the load-test data (how it renders, page sizes measured with single requests during
the build checks) live in VARIANTS.

  python3 report/build.py
"""
import csv
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TSV = os.path.join(ROOT, "sim", "results", "results.tsv")

# group: what the server does per page view
#   hydrate  = renders HTML and ships the data/JS for the browser to take the page over (SSR + hydration)
#   template = renders HTML only, no client framework (server templates)
#   static   = static files; the browser renders from JSON (client-side rendering)
VARIANTS = {
    "nextjs":         dict(name="Next.js", lang="TypeScript · Node", group="hydrate", feed_kb=46.6, version="Next.js 16.4, React 19.3",
                           how="React Server Components: render to the RSC payload, then render that to HTML; the payload is inlined for hydration; static shell + streamed holes (Partial Prerendering); gzip in Node by default."),
    "nextjs-tuned":   dict(name="Next.js (tuned)", lang="TypeScript · Node", group="hydrate", feed_kb=25.2, version="Next.js 16.4, React 19.3",
                           how="Plain Next.js after profiling, still no caching: cacheComponents/Partial Prerendering off (one dynamic render instead of a staged render plus a prefetch render), the post card as a Client Component (props instead of a rendered tree in the RSC payload), V8 heap sized for the container."),
    "nextjs-bun":     dict(name="Next.js on Bun", lang="TypeScript · Bun", group="hydrate", feed_kb=46.6, version="Next.js 16.4, React 19.3, Bun 1.4.3",
                           how="The same Next.js app and production build as Next.js; only the runtime changes: the standalone server.js runs on Bun instead of Node."),
    "nextjs-cached":  dict(name="Next.js cached", lang="TypeScript · Node", group="hydrate", feed_kb=44.7, version="Next.js 16.4, use cache",
                           how="Same app with 'use cache' and tag invalidation: post pages are stored after the first visit; the feed still renders per request from cached data."),
    "nextjs-smart":   dict(name="Next.js smart cache", lang="TypeScript · Node", group="hydrate", feed_kb=39.4, version="Next.js 16.4, use cache + ISR",
                           how="Whole feed page stored and regenerated every 15 s (never forced); post pages stored until edited; like counts fetched by the browser straight from the API. The server mostly serves stored HTML.", web_share=0.52),
    "nextjs-fullcache": dict(name="Next.js full cache", lang="TypeScript · Node", group="hydrate", feed_kb=39.4, version="Next.js 16.4, use cache + ISR",
                           how="Whole feed page stored and regenerated every 30 s (never forced); post pages stored until edited; like counts only from the stored pages. The ceiling of Next.js caching."),
    "remix":          dict(name="Remix (React Router 7)", lang="TypeScript · Node", group="hydrate", feed_kb=18.9, version="React Router 7.18",
                           how="Loaders, then one React renderToPipeableStream pass; loader data embedded for hydration (~6.8 KB); Express server with gzip and per-request logging on by default."),
    "tanstack-start": dict(name="TanStack Start", lang="TypeScript · Node", group="hydrate", feed_kb=20.4, version="Start 1.168, Query 5.104",
                           how="Loaders fill a per-request TanStack Query cache, one streaming React render; dehydrated query data embedded (~7 KB)."),
    "sveltekit":      dict(name="SvelteKit", lang="TypeScript · Node", group="hydrate", feed_kb=17.0, version="SvelteKit 3.0, Svelte 5.57",
                           how="Compiled Svelte components render by string concatenation; load data serialized into the page; whole page, then send."),
    "nuxt":           dict(name="Nuxt", lang="TypeScript · Node", group="hydrate", feed_kb=15.4, version="Nuxt 4.6, Vue 3.5",
                           how="Vue renderToString via Nitro/h3; useFetch calls the server's own API handler in-process; payload (~4.2 KB) embedded for hydration."),
    "solidstart":     dict(name="SolidStart", lang="TypeScript · Node", group="hydrate", feed_kb=18.9, version="SolidStart 2.0, Solid 1.9",
                           how="Solid's compiled SSR templates (string building with hydration keys), streaming; query data serialized (~4.8 KB)."),
    "qwik":           dict(name="Qwik City", lang="TypeScript · Node", group="hydrate", feed_kb=36.5, version="Qwik 1.20",
                           how="Renders HTML and serializes component state for resumability (~12-13 KB of state); streamed; CSS inlined."),
    "angular":        dict(name="Angular", lang="TypeScript · Node", group="hydrate", feed_kb=19.4, version="Angular 22.2 SSR",
                           how="Builds a server-side DOM per request, then serializes it; hydration annotations, event replay and the HttpClient transfer cache embedded."),
    "astro":          dict(name="Astro", lang="TypeScript · Node", group="template", feed_kb=14.3, version="Astro 7.3, @astrojs/node 11",
                           how="Server-rendered .astro templates with no client framework (zero JS); HTML forms via Astro Actions; CSS inlined."),
    "express":        dict(name="Express + EJS", lang="JavaScript · Node", group="template", feed_kb=10.5, version="Express 5.3, EJS 7.0",
                           how="EJS templates compiled to JS functions once; render = string concatenation; nothing else. The Node baseline."),
    "express-nunjucks": dict(name="Express + Nunjucks", lang="JavaScript · Node", group="template", feed_kb=12.2, version="Express 5.3, Nunjucks 3.2.4",
                           how="The same Express app with Jinja2-style Nunjucks templates (inheritance, includes, autoescape) instead of EJS; compiled once in production."),
    "flask":          dict(name="Flask + Jinja2", lang="Python", group="template", feed_kb=10.5, version="Flask 3.1, Python 3.14, gunicorn 26",
                           how="Jinja2 templates compiled to Python once; 3 sync gunicorn workers (one request each, Connection: close on every response)."),
    "django":         dict(name="Django", lang="Python", group="template", feed_kb=14.0, version="Django 6.1, Python 3.14, gunicorn 26",
                           how="Django templates (node tree evaluation) behind the middleware stack; CSRF tokens; 3 sync gunicorn workers."),
    "aspnet":         dict(name="ASP.NET Core Razor", lang="C#", group="template", feed_kb=16.4, version=".NET 10, Razor Pages",
                           how="Razor views compiled to C# at build time; Kestrel; antiforgery tokens in every form (~4.6 KB of the feed)."),
    "laravel":        dict(name="Laravel + Blade", lang="PHP", group="template", feed_kb=12.7, version="Laravel 13.35, PHP 8.5",
                           how="PHP-FPM (10 workers) behind nginx: the framework boots on every request; file sessions for CSRF; OPcache on."),
    "spring":         dict(name="Spring Boot + Thymeleaf", lang="Java", group="template", feed_kb=10.5, version="Spring Boot 4.1, JDK 25",
                           how="Thymeleaf evaluates templates per request over Tomcat's thread-per-request model; JVM defaults (SerialGC, 512 MB max heap)."),
    "rust-axum":      dict(name="Rust Axum + Askama", lang="Rust", group="template", feed_kb=10.5, version="Axum 0.8, Askama 0.16",
                           how="Askama compiles templates into Rust code at build time; render = writing into one pre-sized String; Tokio."),
    "nextjs-deno":    dict(name="Next.js on Deno", lang="TypeScript · Deno", group="hydrate", feed_kb=46.6, version="Next.js 16.4, React 19.3, Deno 2.9.7",
                           how="The same Next.js app and production build as Next.js; the standalone server.js runs on Deno's Node compatibility layer."),
    "nextjs-nginx-cache": dict(name="Next.js + nginx microcache", lang="TypeScript · Node + nginx", group="hydrate", feed_kb=46.6, version="Next.js 16.4, nginx 1.22",
                           how="Plain Next.js behind an nginx proxy_cache in the same box: anonymous feed cached 1 s, post pages 5 s; writes and logged-in users bypass it."),
    "express-bun":    dict(name="Express + Nunjucks on Bun", lang="JavaScript · Bun", group="template", feed_kb=12.2, version="Express 5.3, Nunjucks 3.2.4, Bun 1.4.3",
                           how="The same app and dependencies as Express + Nunjucks; only the runtime changes: server.js runs on Bun instead of Node."),
    "hono-jsx-node":  dict(name="Hono JSX on Node", lang="TypeScript · Node", group="template", feed_kb=11.4, version="Hono 4.13, Node 24",
                           how="Hono's server-only JSX renders components straight to an HTML string; no client framework, no hydration."),
    "hono-jsx-bun":   dict(name="Hono JSX on Bun", lang="TypeScript · Bun", group="template", feed_kb=11.4, version="Hono 4.13, Bun 1.4.3",
                           how="The same Hono JSX app on Bun's native HTTP server."),
    "honox":          dict(name="HonoX on Bun", lang="TypeScript · Bun", group="hydrate", feed_kb=14.6, version="HonoX 0.1.62, Hono 4.13, Bun 1.4.3",
                           how="Hono's metaframework: file-based routes, hono/jsx rendered to a string, one island (the like button) hydrated in the browser; Vite build served by Bun."),
    "go":             dict(name="Go html/template", lang="Go", group="template", feed_kb=10.5, version="Go 1.27, standard library",
                           how="net/http + html/template parsed once at startup; contextual autoescaping by reflection over the data; GOMAXPROCS 2 (Go's floor)."),
    "rails":          dict(name="Rails + ERB", lang="Ruby", group="template", feed_kb=14.0, version="Rails 8.1, Ruby 4.0 + YJIT, Puma 8",
                           how="Rails 8 production defaults: one Puma process with 3 threads, ERB partials, cookie session + per-form CSRF tokens, request logging at info."),
    "phoenix":        dict(name="Phoenix + HEEx", lang="Elixir", group="template", feed_kb=13.1, version="Phoenix 1.8, Elixir 1.20, OTP 29",
                           how="Controllers render HEEx function components into iodata (no string concatenation); Bandit; cookie session + CSRF; gzip on by default."),
    "laravel-octane": dict(name="Laravel Octane", lang="PHP", group="template", feed_kb=12.7, version="Laravel 13.35, Octane 2.21, FrankenPHP 1.13",
                           how="The same Laravel app kept booted between requests by Octane on FrankenPHP (2 workers); no per-request framework boot, no nginx/FastCGI hop."),
    "laravel-tuned":  dict(name="Laravel Octane (tuned)", lang="PHP", group="template", feed_kb=12.7, version="Laravel 13.35, Octane 2.21, FrankenPHP 1.13",
                           how="Laravel Octane after profiling: keep-alive to the API, cookie sessions instead of files, no XSRF cookie, Blade timestamp checks off, fewer Octane listeners, OPcache JIT, post card as an @include."),
    "leptos":         dict(name="Leptos SSR", lang="Rust · WASM", group="hydrate", feed_kb=15.7, version="Leptos 0.8, Axum",
                           how="Rust components rendered on the server (async mode) with hydration data for the WASM client; the full-stack Rust counterpart to Next.js."),
    "sveltekit-tuned": dict(name="SvelteKit (fixed)", lang="TypeScript · Node", group="hydrate", feed_kb=17.0, version="SvelteKit 3.0, Svelte 5.57",
                           how="SvelteKit with one line moved: the date formatter (Intl.DateTimeFormat) is created once per process instead of once per post card."),
    "astro-tuned":    dict(name="Astro (fixed)", lang="TypeScript · Node", group="template", feed_kb=14.3, version="Astro 7.3, @astrojs/node 11",
                           how="Astro with one line moved: the date formatter (Intl.DateTimeFormat) is created once per process instead of once per post card."),
    "spring-tuned":   dict(name="Spring Boot (AOT cache)", lang="Java", group="template", feed_kb=10.5, version="Spring Boot 4.1, JDK 25 AOT cache",
                           how="Spring with the JDK 25 AOT cache (Spring Boot's documented recipe), so a fresh container isn't stuck JIT-compiling during its first minute."),
    "django-tuned":   dict(name="Django (tuned)", lang="Python", group="template", feed_kb=14.0, version="Django 6.1 + Jinja2 backend, Python 3.14",
                           how="Django with its built-in Jinja2 backend and a precompiled standard library (the 2 s healthcheck was recompiling urllib/email every time)."),
    "flask-tuned":    dict(name="Flask (precompiled stdlib)", lang="Python", group="template", feed_kb=10.5, version="Flask 3.1, Python 3.14, gunicorn 26",
                           how="Flask with only a precompiled standard library, so the 2 s healthcheck stops recompiling urllib/email from source (~20% of the CPU budget)."),
    "aspnet-tuned":   dict(name="ASP.NET (tuned)", lang="C#", group="template", feed_kb=16.4, version=".NET 10, Razor Pages",
                           how="ASP.NET with thread-pool spinning off, precompiled (ReadyToRun) publish, background GC off and invariant globalization."),
    "remix-bun":      dict(name="React Router 7 on Bun", lang="TypeScript · Bun", group="hydrate", feed_kb=18.9, version="React Router 7.18, React 19.3, Bun 1.4.3",
                           how="The same React Router 7 app as remix, served by Bun.serve through react-router's Web Request/Response handler (no Express, no gzip, no request log)."),
    "nextjs-csr":     dict(name="Next.js static (CSR)", lang="TypeScript · nginx", group="static", feed_kb=7.3, version="Next.js 16.4 export + nginx 1.27",
                           how="Static HTML/JS from nginx; the browser fetches JSON through nginx's /api proxy and renders it. The server renders nothing."),
}

# Capped stacks: a CPU/memory-based projection of the real limit (sim/predict.py and the cap run's numbers), shown as
# an estimate next to the measured score, never instead of it.
ESTIMATES = {
    "rust-axum": dict(users=50000, why="30,000-user hold at 54% web CPU, 51% API CPU, 1,053 MiB: CPU reaches 95% near "
                      "52,000, memory (~33 KB per connection) runs out near 58,000, the shared API near 56,000"),
    "nextjs-csr": dict(users=42000, why="one 30,000-user run, p95 41 ms: nginx (the web box) at 67% of its vCPU, the API at "
                       "47%: nginx reaches 95% near 42,000-43,000, the API near 60,000"),
}

pct = lambda s: float(s.rstrip("%")) if s else None
num = lambda s: float(s) if s not in (None, "") else None

all_rows = [r for r in csv.DictReader(open(TSV), delimiter="\t") if r["verdict"] != "INVALID"]
rows = [r for r in all_rows if r.get("mem_per_server", "2g") == "2g"]          # scores: 2 GB runs only
# RAM check: the same variant at the same user count with more memory, next to its 2 GB run
ram_check = []
for r in sorted((r for r in all_rows if r.get("mem_per_server", "2g") != "2g"), key=lambda r: r["run"]):
    base = [b for b in rows if b["variant"] == r["variant"] and b["users"] == r["users"] and b["hold"] == r["hold"]
            and b["cpus_per_server"] == r["cpus_per_server"]]
    b = sorted(base, key=lambda b: b["run"])[-1] if base else None
    side = lambda x: None if x is None else dict(mem=x["mem_per_server"], ok=x["verdict"] == "PASS", req_s=int(x["req_s"]),
        p95=int(x["p95_ms"]), p99=int(x["p99_ms"]), errors=float(x["errors_pct"]), web_cpu_of_vcpu=pct(x["web_cpu_of_quota"]),
        web_mem_peak=num(x["web_mem_peak_mib"]))
    ram_check.append(dict(id=r["variant"], users=int(r["users"]), run=r["hold"], base=side(b), more=side(r)))
by = {}
fixed = {}                                                                     # sim/fixed-load.sh: same 400 users for all
for r in rows:
    if r["hold"] == "3m":
        if r["cpus_per_server"] == "0.4":
            if r["variant"] not in fixed or r["run"] > fixed[r["variant"]]["run"]:
                fixed[r["variant"]] = r                                        # latest run wins
        continue
    by.setdefault((r["variant"], r["cpus_per_server"]), []).append(r)

variants = []
for key, meta in VARIANTS.items():
    rs = sorted(by.get((key, "0.4"), []), key=lambda r: r["run"])
    holds = [r for r in rs if r["hold"] == "5m" and r["verdict"] == "PASS"]
    entry = dict(id=key, **meta)
    if not holds:
        entry["status"] = "queued" if not rs else "running"
        variants.append(entry)
        continue
    h = holds[-1]
    users = int(h["users"])
    best_2m = max((int(r["users"]) for r in rs if r["hold"] == "2m" and r["verdict"] == "PASS"), default=None)
    fails = sorted((r for r in rs if r["verdict"] == "FAIL" and int(r["users"]) > users), key=lambda r: int(r["users"]))
    web_cpu = pct(h["web_cpu_load_avg"])
    req_s = int(h["req_s"])
    capped = users >= 16000 and not fails            # passed the search's cap (16,000, later 30,000) with no failure above
    entry.update(
        status="done", users=users, capped=capped, req_s=req_s, estimate=ESTIMATES.get(key),
        p95=int(h["p95_ms"]), p99=int(h["p99_ms"]), errors=float(h["errors_pct"]),
        web_cpu=web_cpu, web_cpu_of_vcpu=pct(h["web_cpu_of_quota"]), web_mem_peak=num(h["web_mem_peak_mib"]),
        api_cpu=pct(h["api_cpu_load_avg"]), api_cpu_of_vcpu=pct(h["api_cpu_of_quota"]), api_mem_peak=num(h["api_mem_peak_mib"]),
        # CPU time per request at the score (web box): cores used / requests per second, in ms
        # web requests only: smart-load.js sends ~48% of its requests (live like counts) straight to the API box
        cpu_ms_per_req=round(web_cpu / 100 / (req_s * meta.get("web_share", 1.0)) * 1000, 2) if web_cpu and req_s else None,
        best_2m=best_2m, hold_drop_pct=0 if capped else (round((best_2m - users) / best_2m * 100) if best_2m and best_2m > users else 0),
        first_fail=dict(users=int(fails[0]["users"]), run=fails[0]["hold"], p95=int(fails[0]["p95_ms"]),
                        p99=int(fails[0]["p99_ms"]), errors=float(fails[0]["errors_pct"])) if fails else None,
        steps=[dict(users=int(r["users"]), run=r["hold"], ok=r["verdict"] == "PASS", p95=int(r["p95_ms"]), p99=int(r["p99_ms"]))
               for r in rs],
    )
    variants.append(entry)

baseline_rows = sorted(by.get(("nextjs", "1.0"), []), key=lambda r: r["run"])
one_core = [r for r in baseline_rows if r["hold"] == "5m" and r["verdict"] == "PASS"]
data = dict(
    generated=max(r["run"] for r in rows)[:13],
    variants=variants,
    nextjs_one_core=dict(users=int(one_core[-1]["users"]), req_s=int(one_core[-1]["req_s"])) if one_core else None,
    api_throughput=dict(feed_rps=39400, post_rps=177600),
    ram_check=ram_check,
    # sim/fixed-load.sh: every variant at the same 400 users (3-minute run), for a same-load latency comparison
    fixed_load={v: dict(users=int(r["users"]), ok=r["verdict"] == "PASS", req_s=int(r["req_s"]), med=int(r["med_ms"]),
                        p95=int(r["p95_ms"]), p99=int(r["p99_ms"]), errors=float(r["errors_pct"]),
                        web_cpu_of_vcpu=pct(r["web_cpu_of_quota"]), web_mem=num(r["web_mem_load_avg_mib"]))
                for v, r in sorted(fixed.items())},
    setup=dict(cpus="0.4 vCPU", mem="2 GB, no swap", thresholds="p95 < 500 ms, p99 < 1 s, errors < 1%",
               hold="5 minutes", cap=30000, host="Intel i7-12700K performance cores"),
)
blob = json.dumps(data, separators=(",", ":"))
for name in ("analysis", "deck"):
    tpl = os.path.join(HERE, f"{name}.template.html")
    if os.path.exists(tpl):
        html = open(tpl).read().replace("/*__DATA__*/null", blob)
        open(os.path.join(HERE, f"{name}.html"), "w").write(html)
open(os.path.join(HERE, "data.json"), "w").write(json.dumps(data, indent=1))
done = [v for v in variants if v.get("status") == "done"]
print(f"{len(done)}/{len(variants)} variants scored -> report/data.json" +
      "".join(f", report/{n}.html" for n in ("analysis", "deck") if os.path.exists(os.path.join(HERE, f'{n}.template.html'))))
