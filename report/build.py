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
    "nextjs-csr":     dict(name="Next.js static (CSR)", lang="TypeScript · nginx", group="static", feed_kb=7.3, version="Next.js 16.4 export + nginx 1.27",
                           how="Static HTML/JS from nginx; the browser fetches JSON through nginx's /api proxy and renders it. The server renders nothing."),
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
for r in rows:
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
    entry.update(
        status="done", users=users, capped=users >= 16000, req_s=req_s,
        p95=int(h["p95_ms"]), p99=int(h["p99_ms"]), errors=float(h["errors_pct"]),
        web_cpu=web_cpu, web_cpu_of_vcpu=pct(h["web_cpu_of_quota"]), web_mem_peak=num(h["web_mem_peak_mib"]),
        api_cpu=pct(h["api_cpu_load_avg"]), api_cpu_of_vcpu=pct(h["api_cpu_of_quota"]), api_mem_peak=num(h["api_mem_peak_mib"]),
        # CPU time per request at the score (web box): cores used / requests per second, in ms
        # web requests only: smart-load.js sends ~48% of its requests (live like counts) straight to the API box
        cpu_ms_per_req=round(web_cpu / 100 / (req_s * meta.get("web_share", 1.0)) * 1000, 2) if web_cpu and req_s else None,
        best_2m=best_2m, hold_drop_pct=0 if users >= 16000 else (round((best_2m - users) / best_2m * 100) if best_2m and best_2m > users else 0),
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
    setup=dict(cpus="0.4 vCPU", mem="2 GB, no swap", thresholds="p95 < 500 ms, p99 < 1 s, errors < 1%",
               hold="5 minutes", cap=16000, host="Intel i7-12700K performance cores"),
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
