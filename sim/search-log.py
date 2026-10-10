#!/usr/bin/env python3
"""Writes the per-variant search path (every k6 user count tried, in order) for the video:

  SEARCH_LOG.md                  one table per variant: step, time, users, run length, pass/fail, latency, errors,
                                 CPU and memory of both servers, plus the probe that picked the start and the score
  sim/results/search-path.csv    the same rows, one per run, for spreadsheets and charts

Source of truth: sim/results/results.tsv (rebuilt from the run folders by results-table.py) and the per-variant
search logs (sim/results/search-<variant>-cpu<N>.log) for the probe line, the score and build failures.

  python3 sim/search-log.py
"""
import csv
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RESULTS = os.path.join(HERE, "results")
TSV = os.path.join(RESULTS, "results.tsv")

rows = list(csv.DictReader(open(TSV), delimiter="\t"))
for r in rows:                       # a run with non-default memory is listed as its own variant
    if r.get("mem_per_server", "2g") != "2g":
        r["variant"] = f"{r['variant']} (RAM check, {r['mem_per_server']})"


def when(run):  # 20261009-134746-... -> 2026-10-09 13:47
    m = re.match(r"(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})", run)
    return f"{m[1]}-{m[2]}-{m[3]} {m[4]}:{m[5]}" if m else run


def search_meta(variant, cpus):
    """(probe line, score line, build failures) from the variant's search log, if any."""
    tag = "1.0" if cpus in ("1", "1.0") else cpus
    path = os.path.join(RESULTS, f"search-{variant}-cpu{tag}.log")
    probe = score = None
    failed_builds = 0
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            if line.startswith("== probe:"):
                probe = line[3:].strip()
            elif line.startswith("SCORE "):
                score = line.split(":", 1)[1].strip()
            elif "exit build-failed" in line:
                failed_builds += 1
    return probe, score, failed_builds


groups = {}
for r in rows:
    groups.setdefault((r["variant"], r["cpus_per_server"]), []).append(r)


def score_users(rs):
    holds = [int(r["users"]) for r in rs if r["hold"] == "5m" and r["verdict"] == "PASS"]
    return max(holds) if holds else -1


order = sorted(groups, key=lambda k: (k[1] != "0.4", -score_users(groups[k]), k[0]))

md = ["# Search log", "",
      "Every k6 run, per variant, in the order it ran: the user count tried, the run length (2-minute search runs, "
      "5-minute confirmation holds), whether it passed (p95 < 500 ms, p99 < 1 s, errors < 1%), and what both servers "
      "did. CPU is under full load (after ramp-up, before ramp-down); \"% of vCPU\" is relative to each server's "
      "budget (0.4 vCPU on the main runs, so 100% = saturated). Memory is the peak.",
      "",
      "Each run: 60 s ramp-up to the user count, then the hold, then 30 s ramp-down; a fresh database and a fresh "
      "web container before every run. One user loops: feed page, think 3-7 s, post page, think 3-8 s, like (15%), "
      "new post (2%), idle 5-15 s (about 0.09 requests/s per user for server-rendered pages).",
      "",
      "Raw data: `sim/results/search-path.csv` (same rows) and `sim/results/<run>/` (k6 log, k6 summary JSON, "
      "2-second CPU/memory samples).", ""]

csv_rows = []
for variant, cpus in order:
    rs = sorted(groups[(variant, cpus)], key=lambda r: r["run"])
    probe, score, failed_builds = search_meta(variant, cpus)
    valid = [r for r in rs if r["verdict"] != "INVALID"]
    invalid = [r for r in rs if r["verdict"] == "INVALID"]
    title = f"## `{variant}` at {cpus} vCPU"
    md.append(title)
    md.append("")
    md.append(f"**Score: {score or ('see holds below' if valid else 'none')}**" +
              (f"  ·  start chosen by probe: {probe.replace('probe: ', '')}" if probe else ""))
    if failed_builds:
        md.append(f"  ·  image build failed {failed_builds} time(s) before this search (fixed and requeued)")
    md.append("")
    md.append("| # | started (UTC+5) | users | run | result | req/s | median | p95 | p99 | errors | web CPU (% of vCPU) | web mem | api CPU | api mem |")
    md.append("|---:|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|---:|")
    for i, r in enumerate(valid, 1):
        verdict = "✅ pass" if r["verdict"] == "PASS" else "❌ fail"
        md.append(f"| {i} | {when(r['run'])} | {int(r['users']):,} | {r['hold']} | {verdict} | {r['req_s']} | "
                  f"{r['med_ms']} ms | {r['p95_ms']} ms | {r['p99_ms']} ms | {r['errors_pct']}% | "
                  f"{r['web_cpu_load_avg']} ({r['web_cpu_of_quota']}) | {r['web_mem_peak_mib']} MiB | "
                  f"{r['api_cpu_load_avg']} ({r['api_cpu_of_quota']}) | {r['api_mem_peak_mib']} MiB |")
        csv_rows.append({"variant": variant, "cpus_per_server": cpus, "step": i, "started": when(r["run"]),
                         "users": r["users"], "run_length": r["hold"], "result": r["verdict"],
                         "req_s": r["req_s"], "median_ms": r["med_ms"], "p95_ms": r["p95_ms"], "p99_ms": r["p99_ms"],
                         "errors_pct": r["errors_pct"], "web_cpu_load_avg": r["web_cpu_load_avg"],
                         "web_cpu_of_vcpu": r["web_cpu_of_quota"], "web_cpu_peak": r["web_cpu_peak"],
                         "web_mem_avg_mib": r["web_mem_load_avg_mib"], "web_mem_peak_mib": r["web_mem_peak_mib"],
                         "api_cpu_load_avg": r["api_cpu_load_avg"], "api_cpu_of_vcpu": r["api_cpu_of_quota"],
                         "api_mem_peak_mib": r["api_mem_peak_mib"], "score": score or "", "run_folder": r["run"]})
    if invalid:
        md.append("")
        md.append(f"Excluded: {len(invalid)} run(s) invalidated by a load-generator limit (k6 ran out of local ports; "
                  f"see RESULTS.md caveats): " + ", ".join(f"{int(r['users']):,} users {r['hold']}" for r in invalid) + ".")
    md.append("")

open(os.path.join(ROOT, "SEARCH_LOG.md"), "w").write("\n".join(md))
with open(os.path.join(RESULTS, "search-path.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(csv_rows[0].keys()))
    w.writeheader()
    w.writerows(csv_rows)
print(f"{len(order)} variants, {len(csv_rows)} runs -> SEARCH_LOG.md, sim/results/search-path.csv")
