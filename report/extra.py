#!/usr/bin/env python3
"""Extra analysis from report/data.json (run report/build.py first): cost per million page views, latency at the
same load (sim/fixed-load.sh), page size vs CPU per request, and memory. Writes ANALYSIS-extra.md at the repo root.

  python3 report/build.py && python3 report/extra.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
d = json.load(open(os.path.join(HERE, "data.json")))
vs = [v for v in d["variants"] if v.get("status") == "done"]
vs.sort(key=lambda v: -v["users"])
name = {v["id"]: v["name"] for v in d["variants"]}

DROPLET = 12.0                      # $ per month for the web box (the API box costs the same again, not counted)
MONTH_S = 30 * 24 * 3600
PV_PER_USER_S = round(2 / 20.5, 4)   # bench/ssr-load.js: feed + post page per loop; sleeps 3-7, 3-8, 5-15 s
out = []
w = out.append

w("# Extra analysis\n")
w(f"Generated from `report/data.json` ({d['generated']}). All runs at 0.4 vCPU / 2 GB per server, same load script "
  "and pass rules as the main results. Numbers for stacks that hit the 30,000-user cap are lower bounds.\n")

# --- cost -------------------------------------------------------------------------------------------------------
w("## 1. Cost per million page views\n")
w(f"A ${DROPLET:.0f}/month web server running flat out at its score, 24/7. Every simulated user views 2 pages per "
  f"~20.5 s loop (feed, then a post; the like/new-post requests aren't counted), so page views per second = users × "
  f"{PV_PER_USER_S}. That × 30 days = page views per month; cost = $12 ÷ millions of page views. This uses users, not "
  "raw req/s, so stacks measured with a different load script (CSR, smart cache) compare fairly. Real traffic isn't "
  "flat, so treat it as the floor: what a page view costs when the box is fully used. The API box is the same for every "
  "stack and not included.\n")
w("| Stack | Users held | Page views / month | $ per million page views | Servers for 10,000 users |")
w("|---|---:|---:|---:|---:|")
for v in vs:
    per_month = v["users"] * PV_PER_USER_S * MONTH_S
    cost = DROPLET / (per_month / 1e6)
    servers = math.ceil(10000 / v["users"])
    cap = "+" if v.get("capped") else ""
    w(f"| {v['name']} | {v['users']:,}{cap} | {per_month / 1e6:,.0f} M | ${cost:.4f}{' (or less)' if cap else ''} | "
      f"{servers}{' (or fewer)' if cap else ''} |")
w("")

# --- fixed load -------------------------------------------------------------------------------------------------
fl = d.get("fixed_load") or {}
if fl:
    users = next(iter(fl.values()))["users"]
    w(f"## 2. Latency at the same load ({users} users for everyone)\n")
    w(f"Every stack at {users} users (below the weakest stack's limit), one 3-minute run after a 60 s ramp-up, fresh "
      "database and container. This is what a visitor feels when the server is *not* overloaded.\n")
    w("**Read the CPU column with care.** At 400 users it is mostly *not* rendering cost. Docker runs each stack's "
      "healthcheck inside its 0.4-vCPU quota every 2 s: about 8% of the vCPU for Node/Bun/Deno `fetch` checks, about 3% "
      "for curl/wget, 7-21% for Python. That is 44-66% of all instructions a Node web container executes at 400 users. "
      "On top of that, a mostly idle core runs at a low clock (1.8-3.6 GHz against 4.1-4.6 GHz when busy) with fewer "
      "instructions per cycle, so the same work costs 1.5-2.5x more CPU time, and the sim samples `docker stats` only "
      "~25% of the time, so a single run is uncertain by about ±5 points. Example: SvelteKit's formatter fix cuts "
      "instructions per request by 51% at 400 users (measured in isolation), yet both versions read 26% here. Use the "
      "latency columns from this table, and CPU per request at each stack's limit (section 3, main results) for "
      "efficiency. Details: `research/anomalies-sveltekit-lowload.md`.\n")
    w("| Stack | median | p95 | p99 | errors | web CPU incl. healthcheck (% of 0.4 vCPU, ±5) | memory |")
    w("|---|---:|---:|---:|---:|---:|---:|")
    for vid, r in sorted(fl.items(), key=lambda kv: (kv[1]["p95"], kv[1]["med"])):
        w(f"| {name.get(vid, vid)} | {r['med']} ms | {r['p95']} ms | {r['p99']} ms | {r['errors']}% | "
          f"{r['web_cpu_of_vcpu']:.0f}% | {r['web_mem']:.0f} MiB |")
    w("")

# --- page size vs CPU ---------------------------------------------------------------------------------------------
def pearson(xs, ys):
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs)); sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return sxy / (sx * sy)

def ranks(xs):
    order = sorted(range(len(xs)), key=lambda i: xs[i]); r = [0.0] * len(xs); i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        for k in range(i, j + 1):
            r[order[k]] = (i + j) / 2
        i = j + 1
    return r

pts = [v for v in vs if v.get("cpu_ms_per_req") and v.get("feed_kb") and not v.get("capped") and v["group"] != "static"]
w("## 3. Does a heavier page cost more CPU?\n")
w("Feed page size (uncompressed HTML, measured once per stack) against CPU time per request at the score.\n")
w("| Stack | feed page | CPU per request | group |")
w("|---|---:|---:|---|")
for v in sorted(pts, key=lambda v: v["feed_kb"]):
    w(f"| {v['name']} | {v['feed_kb']} KB | {v['cpu_ms_per_req']} ms | {v['group']} |")
xs = [v["feed_kb"] for v in pts]; ys = [v["cpu_ms_per_req"] for v in pts]
if len(pts) > 3:
    r = pearson(xs, ys); rho = pearson(ranks(xs), ranks(ys))
    w(f"\nAcross {len(pts)} stacks (capped ones and the static build left out): Pearson r = {r:.2f}, Spearman ρ = {rho:.2f}.")
    small = [v for v in pts if v["feed_kb"] <= 20]
    if small:
        lo, hi = min(small, key=lambda v: v["cpu_ms_per_req"]), max(small, key=lambda v: v["cpu_ms_per_req"])
        w(f"Among pages of 20 KB or less the CPU cost still ranges from {lo['cpu_ms_per_req']} ms ({lo['name']}) to "
          f"{hi['cpu_ms_per_req']} ms ({hi['name']}), so page size alone doesn't explain the cost: how the page is "
          "produced does. The Next.js variants are both the heaviest pages and the most expensive renders, which "
          "drives most of the correlation.\n")

# --- memory -------------------------------------------------------------------------------------------------------
w("## 4. Memory\n")
w("Peak memory of the web container during its 5-minute hold at the score. No stack came near the 2 GB limit, "
  "so memory never decided a score.\n")
w("| Stack | peak memory | users held |")
w("|---|---:|---:|")
for v in sorted(vs, key=lambda v: -(v.get("web_mem_peak") or 0)):
    w(f"| {v['name']} | {v['web_mem_peak']:.0f} MiB | {v['users']:,}{'+' if v.get('capped') else ''} |")
w("")

# --- anomalies ----------------------------------------------------------------------------------------------------
FIXES = [  # (original, fixed, cause, fix); details in research/anomalies-*.md
    ("sveltekit", "sveltekit-tuned", "A new `Intl.DateTimeFormat` for every post card (21 per page). Building one is expensive "
     "(ICU locale data) and it's also why SvelteKit sat at ~800 MB of memory.", "Create the formatter once at module scope."),
    ("astro", "astro-tuned", "The same per-card `Intl.DateTimeFormat`.", "Same one-line move."),
    ("spring", "spring-tuned", "Every new container starts with a cold JIT, and the 5-minute hold spends much of its CPU "
     "compiling. Virtual threads made it worse.", "JDK 25 AOT cache built at image build time."),
    ("django", "django-tuned", "The 2 s healthcheck runs inside the 0.4-CPU quota and kept recompiling Python bytecode "
     "and templates; the Django template engine is also slow.", "Precompiled stdlib bytecode and the Jinja2 backend."),
    ("flask", "flask-tuned", "The same healthcheck bytecode recompilation.", "Precompiled stdlib bytecode."),
    ("aspnet", "aspnet-tuned", "About 19% of the CPU went to idle thread-pool spinning.", "Thread-pool spin-wait off, "
     "ReadyToRun, no background GC, invariant globalization."),
    ("laravel", "laravel-octane", "PHP-FPM boots the whole framework for every request.", "Octane on FrankenPHP keeps it "
     "booted: barely helps, because boot was never the main cost."),
    ("laravel", "laravel-tuned", "No single hotspot: framework floor ~31%, sessions and cookies ~20%, Blade components "
     "~38%, a new API connection per request ~11%. The file session driver also writes one file per cookie-less visitor "
     "and its clean-up scans the whole directory, so plain Laravel gets slower as a run goes on.",
     "Octane plus keep-alive to the API, cookie sessions, no XSRF cookie, no Blade timestamp checks, fewer Octane "
     "listeners, OPcache JIT, `@include` instead of a component."),
    ("nextjs", "nextjs-tuned", "`cacheComponents` also turns on cached navigations, so every request ran a staged RSC render plus "
     "a second \"runtime prefetch\" render, both useless on pages that are all request-time data; each post card went to the "
     "browser twice (HTML and its rendered tree in the RSC payload).", "`cacheComponents` off, the post card as a Client Component "
     "(props instead of a tree; feed page 45 to 25 KB), V8 heap sized for the container. Still no caching."),
]
byid = {v["id"]: v for v in d["variants"]}
w("## 5. Odd results, and what fixed them\n")
w("Where a stack scored far below stacks doing similar work, we profiled it and tried one idiomatic fix, the kind a "
  "team would ship. The original numbers stay in the main table; these are the fixed variants.\n")
w("| Stack | before | after | gain | cause | fix |")
w("|---|---:|---:|---:|---|---|")
for a, b, cause, fix in FIXES:
    va, vb = byid.get(a, {}), byid.get(b, {})
    if not (va.get("users") and vb.get("users")):
        continue
    w(f"| {vb['name']} | {va['users']:,} | {vb['users']:,} | {vb['users'] / va['users'] + 1e-9:.1f}× | {cause} | {fix} |")
w("\nChecked and found nothing wrong: Angular, Qwik and Nuxt (their CPU goes into rendering itself). Node's heap is "
  "sized from the host's 31 GB, not the 2 GB limit, which inflates memory numbers but not CPU. Rust's memory at 30,000 "
  "users is ~33 KB per open connection. Healthchecks run inside the 0.4-CPU quota for every stack: at idle, a Python "
  "healthcheck alone used ~21% of it, a Node one ~8%, a curl one ~2.5%.\n")

open(os.path.join(ROOT, "ANALYSIS-extra.md"), "w").write("\n".join(out) + "\n")
print("wrote ANALYSIS-extra.md")
