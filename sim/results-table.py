#!/usr/bin/env python3
"""Rebuilds sim/results/results.tsv from every run folder (summary.json + stats.csv), one row per run.

CPU and memory come from the 2-second `docker stats` samples in stats.csv:
  *_cpu_load_avg   average CPU over the full-load window only (after the ramp-up, before the ramp-down)
  *_cpu_peak       highest 2-second sample in the whole run
  *_cpu_of_quota   load average as a share of the box's vCPU budget (CPUS); 100% = the box is saturated
  *_mem_load_avg   average memory (MiB) over the full-load window
  *_mem_peak       highest memory sample (MiB) in the whole run
Docker reports CPU relative to one full core, so at CPUS=0.4 a saturated box shows about 40%.

Verdicts use the load test's thresholds (p95 < 500 ms, p99 < 1000 ms, errors < 1%). Rows previously marked INVALID
in results.tsv stay INVALID.

  python3 sim/results-table.py            # rewrite results/results.tsv
  python3 sim/results-table.py --run DIR  # print one run's CPU/memory summary line (used by sim.sh)
"""
import csv
import json
import os
import re
import sys

RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
TSV = os.path.join(RESULTS, "results.tsv")
RUN = re.compile(r"^(\d{8}-\d{6})-(.+?)(?:-cpu([\d.]+))?(?:-mem(\w+))?-(\d+)vu-(\d+)(s|m)$")
RAMP_UP_S = 60  # ssr-load.js / csr-load.js default; the 15s/40s pipeline checks used shorter ramps
SERVERS = {"web": "perf-sim-web-1", "api": "perf-sim-api-1"}
COLUMNS = ["run", "variant", "script", "cpus_per_server", "mem_per_server", "users", "hold", "verdict",
           "req_s", "med_ms", "p95_ms", "p99_ms", "errors_pct"] + [
    f"{s}_{m}" for s in SERVERS for m in
    ("cpu_load_avg", "cpu_peak", "cpu_of_quota", "mem_load_avg_mib", "mem_peak_mib")]


def mib(text):
    m = re.match(r"([\d.]+)\s*([KMG]i?B|B)", text.strip())
    if not m:
        return None
    v, unit = float(m.group(1)), m.group(2)
    return v * {"B": 1 / 1048576, "KiB": 1 / 1024, "KB": 1 / 1024, "MiB": 1, "MB": 1, "GiB": 1024, "GB": 1024}[unit]


def server_stats(run_dir, hold_s, cpus):
    """{web|api: (cpu_load_avg, cpu_peak, cpu_of_quota, mem_load_avg, mem_peak)} from stats.csv."""
    path = os.path.join(run_dir, "stats.csv")
    samples = {s: [] for s in SERVERS}
    try:
        rows = list(csv.reader(open(path)))[1:]
    except OSError:
        return {}
    by_name = {v: k for k, v in SERVERS.items()}
    for r in rows:
        if len(r) < 4 or r[1] not in by_name:
            continue
        try:
            samples[by_name[r[1]]].append((int(r[0]), float(r[2].rstrip("%")), mib(r[3].split(" / ")[0])))
        except ValueError:
            continue
    out = {}
    for s, xs in samples.items():
        if not xs:
            continue
        t0 = xs[0][0]
        ramp = RAMP_UP_S if hold_s >= 120 else max(5, hold_s // 3)
        load = [x for x in xs if t0 + ramp + 4 <= x[0] <= t0 + ramp + hold_s] or xs
        cpu_avg = sum(x[1] for x in load) / len(load)
        mems_load = [x[2] for x in load if x[2] is not None]
        mems_all = [x[2] for x in xs if x[2] is not None]
        out[s] = (cpu_avg, max(x[1] for x in xs), cpu_avg / (cpus * 100) * 100,
                  sum(mems_load) / len(mems_load) if mems_load else None, max(mems_all) if mems_all else None)
    return out


def fmt_stats(st):
    cells = []
    for s in SERVERS:
        v = st.get(s)
        if not v:
            cells += [""] * 5
            continue
        cpu_avg, cpu_peak, quota, mem_avg, mem_peak = v
        cells += [f"{cpu_avg:.0f}%", f"{cpu_peak:.0f}%", f"{quota:.0f}%",
                  "" if mem_avg is None else f"{mem_avg:.0f}", "" if mem_peak is None else f"{mem_peak:.0f}"]
    return cells


def parse_run(name):
    m = RUN.match(name)
    if not m:
        return None
    _, variant, cpus, mem, vus, n, unit = m.groups()
    return variant, float(cpus or 1.0), int(vus), int(n) * (60 if unit == "m" else 1), f"{n}{unit}", mem or "2g"


def rebuild():
    old = {}
    if os.path.exists(TSV):
        for row in csv.DictReader(open(TSV), delimiter="\t"):
            old[row["run"]] = row
    rows = []
    for name in sorted(os.listdir(RESULTS)):
        d = os.path.join(RESULTS, name)
        parsed = parse_run(name)
        if not parsed or not os.path.exists(os.path.join(d, "summary.json")):
            continue
        variant, cpus, vus, hold_s, hold, mem = parsed
        x = json.load(open(os.path.join(d, "summary.json")))["metrics"]
        dur, err = x["http_req_duration"], x["http_req_failed"]["value"]
        verdict = "PASS" if dur["p(95)"] < 500 and dur["p(99)"] < 1000 and err < 0.01 else "FAIL"
        prev = old.get(name, {})
        if prev.get("verdict") == "INVALID":
            verdict = "INVALID"
        script = prev.get("script") or ("csr-load.js" if variant.endswith("-csr") else "ssr-load.js")
        rows.append([name, variant, script, f"{cpus:g}" if cpus != 1 else "1.0", mem,
                     str(vus), hold, verdict, str(int(x["http_reqs"]["rate"])), str(int(dur["med"])),
                     str(int(dur["p(95)"])), str(int(dur["p(99)"])), f"{int(err * 10000) / 100:g}"]
                    + fmt_stats(server_stats(d, hold_s, cpus)))
    with open(TSV, "w") as f:
        f.write("\t".join(COLUMNS) + "\n")
        for r in rows:
            f.write("\t".join(r) + "\n")
    print(f"{len(rows)} runs -> {TSV}")


def one_line(run_dir):
    parsed = parse_run(os.path.basename(os.path.normpath(run_dir)))
    if not parsed:
        return
    _, cpus, _, hold_s, _, _ = parsed
    st = server_stats(run_dir, hold_s, cpus)
    parts = []
    for s in SERVERS:
        if s in st:
            cpu_avg, cpu_peak, quota, mem_avg, mem_peak = st[s]
            parts.append(f"{s} cpu {cpu_avg:.0f}% under load ({quota:.0f}% of its vCPU), peak {cpu_peak:.0f}%, "
                         f"mem {mem_avg or 0:.0f} MiB avg / {mem_peak or 0:.0f} MiB peak")
    print("  |  ".join(parts))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--run":
        one_line(sys.argv[2])
    else:
        rebuild()
