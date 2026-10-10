#!/usr/bin/env python3
"""Prints the RESULTS.md scores table from sim/results/results.tsv, or rewrites it in place with --write.

Score = the variant's passing 5-minute hold (latest one). "First failure above" = the lowest failing 2-minute run
above the score. CPU and memory are from the score's hold, measured over the full-load window (see results-table.py).
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TSV = os.path.join(HERE, "results", "results.tsv")
RESULTS_MD = os.path.join(os.path.dirname(HERE), "RESULTS.md")
FRONTENDS = os.path.join(os.path.dirname(HERE), "frontends")
QUEUE = os.path.join(HERE, "queue.txt")
CAP = 16000

rows = [r for r in csv.DictReader(open(TSV), delimiter="\t") if r["verdict"] != "INVALID" and r.get("mem_per_server", "2g") == "2g"]
groups = {}
for r in rows:
    groups.setdefault((r["variant"], r["cpus_per_server"]), []).append(r)


def n(x):
    return f"{int(x):,}"


lines = ["| Variant | vCPU | Score (users, 5-min hold) | req/s | p95 / p99 | First failure above the score "
         "| web CPU under load (% of vCPU) / peak | web memory avg / peak | api CPU under load / peak | api memory avg / peak |",
         "|---|---|---:|---:|---|---|---|---|---|---|"]
scored = []
for (variant, cpus), rs in groups.items():
    holds = [r for r in rs if r["hold"] == "5m" and r["verdict"] == "PASS"]
    if not holds:
        continue
    h = sorted(holds, key=lambda r: r["run"])[-1]
    users = int(h["users"])
    above = sorted((r for r in rs if r["hold"] == "2m" and r["verdict"] == "FAIL" and int(r["users"]) > users),
                   key=lambda r: int(r["users"]))
    if users >= CAP:
        fail = "none (capped at 16,000)"
    elif above:
        f = above[0]
        fail = f"{n(f['users'])} (p95 {n(f['p95_ms'])} ms, p99 {n(f['p99_ms'])} ms, {f['errors_pct']}% errors)"
    else:
        fail = "—"
    score = f"**{n(users)}**" + (" (cap; real limit higher)" if users >= CAP else "")
    scored.append((float(cpus), -users, variant, "| " + " | ".join([
        f"`{variant}`", cpus, score, n(h["req_s"]), f"{h['p95_ms']} / {h['p99_ms']} ms", fail,
        f"{h['web_cpu_load_avg']} ({h['web_cpu_of_quota']}) / {h['web_cpu_peak']}",
        f"{h['web_mem_load_avg_mib']} / {h['web_mem_peak_mib']} MiB",
        f"{h['api_cpu_load_avg']} ({h['api_cpu_of_quota']}) / {h['api_cpu_peak']}",
        f"{h['api_mem_load_avg_mib']} / {h['api_mem_peak_mib']} MiB"]) + " |"))
for *_, line in sorted(scored, key=lambda t: (-t[0] if t[0] != 0.4 else -9, t[1])):
    lines.append(line)

done = {v for v, _ in groups}
queued = [l.split()[0] for l in open(QUEUE) if l.strip()] if os.path.exists(QUEUE) else []
for v in sorted(d for d in os.listdir(FRONTENDS) if os.path.isdir(os.path.join(FRONTENDS, d)) and d != "shared"):
    if v not in {s[2] for s in scored}:
        status = "queued" if v in queued else ("running or searching" if v in done else "not run yet")
        lines.append(f"| `{v}` | 0.4 | {status} | | | | | | | |")
table = "\n".join(lines)

if "--write" in sys.argv:
    md = open(RESULTS_MD).read()
    start = md.index("| Variant | CPUS per server |") if "| Variant | CPUS per server |" in md else md.index("| Variant | vCPU |")
    end = md.index("\n\n", start)
    open(RESULTS_MD, "w").write(md[:start] + table + md[end:])
    print("RESULTS.md scores table updated")
else:
    print(table)
