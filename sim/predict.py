#!/usr/bin/env python3
"""Predict a variant's max users from the 2-minute runs it has passed so far (sim/results/results.tsv).

Two signals, because CPU % alone fails on runtimes that look busy before they are (Bun reads 90-100% from 60% of its
real limit, while throughput keeps rising):

1. CPU line: web (or api) CPU as a share of its vCPU against users, fitted with a straight line through the passing
   runs; the limit is where it reaches 95%. Only trusted while the busiest server is below 90%.
2. Queueing curve: as the server nears its capacity mu (req/s), waiting time grows like 1/(1 - rate/mu). We fit
   p95 = a + b / (1 - rate/mu) to the passing runs (grid search over mu, least squares for a and b) and solve for the
   rate where p95 hits 500 ms and p99 hits 1,000 ms (fitted the same way), then convert that rate to users with the
   load script's measured requests per user. This keeps working when CPU % is pinned.

The prediction is the lower of the usable estimates, at most 1.5x the highest pass. The queueing fit needs 3+ passing
runs with p95 already up 1.5x, since a flat latency curve says nothing about where it bends.

  python3 sim/predict.py express-bun            # one variant
  python3 sim/predict.py --backtest             # how it would have done on finished searches
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TSV = os.path.join(HERE, "results", "results.tsv")
P95, P99, CPU_TARGET = 500.0, 1000.0, 95.0


def load(variant, hold="2m", cpus="0.4"):
    out = []
    for r in csv.DictReader(open(TSV), delimiter="\t"):
        if r["variant"] != variant or r["hold"] != hold or r["cpus_per_server"] != cpus:
            continue
        try:
            out.append(dict(users=int(r["users"]), ok=r["verdict"] == "PASS", rate=float(r["req_s"]),
                            p95=float(r["p95_ms"]), p99=float(r["p99_ms"]),
                            web=float(r["web_cpu_of_quota"].rstrip("%") or 0), api=float(r["api_cpu_of_quota"].rstrip("%") or 0)))
        except ValueError:
            pass
    return sorted(out, key=lambda x: x["users"])


def linfit(xs, ys):
    n = len(xs); mx = sum(xs) / n; my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx == 0:
        return 0.0, my
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    return b, my - b * mx


def queue_fit(rates, lat):
    """Fit lat = a + b/(1 - rate/mu); returns (mu, a, b) with the lowest squared error, a, b >= 0."""
    best = None; top = max(rates)
    for i in range(1, 400):
        mu = top * (1 + i * 0.01)                       # capacity 1% .. 400% above the highest rate seen
        xs = [1 / (1 - r / mu) for r in rates]
        b, a = linfit(xs, lat) if len(rates) >= 3 else (sum(lat) / sum(xs), 0.0)
        if b <= 0:
            continue
        if a < 0:
            a, b = 0.0, sum(l * x for l, x in zip(lat, xs)) / sum(x * x for x in xs)
        err = sum((a + b * x - l) ** 2 for x, l in zip(xs, lat))
        if best is None or err < best[0]:
            best = (err, mu, a, b)
    return best[1:] if best else None


def predict(runs, verbose=False):
    ok = [r for r in runs if r["ok"]]
    if not ok:
        return None, "no passing runs"
    per_user = sum(r["rate"] / r["users"] for r in ok) / len(ok)
    est, why = [], []

    side = "web" if max(r["web"] for r in ok) >= max(r["api"] for r in ok) else "api"
    cpu = [r[side] for r in ok]
    if len(ok) >= 2 and max(cpu) < 90:
        b, a = linfit([r["users"] for r in ok], cpu)
        if b > 0:
            u = (CPU_TARGET - a) / b; est.append(u); why.append(f"{side} CPU line -> {u:,.0f}")
    elif max(cpu) < 90:
        u = ok[-1]["users"] * CPU_TARGET / max(cpu[-1], 1); est.append(u); why.append(f"{side} CPU ratio -> {u:,.0f}")
    else:
        why.append(f"{side} CPU already {max(cpu):.0f}%: not used")

    p95s = [r["p95"] for r in ok]
    if len(ok) >= 3 and max(p95s) >= 1.5 * max(min(p95s), 1):   # latency must have started to bend, else the fit is noise
        rates = [r["rate"] for r in ok]
        for key, lim in (("p95", P95), ("p99", P99)):
            f = queue_fit(rates, [r[key] for r in ok])
            if f:
                mu, a, b = f
                rate = mu * (1 - b / (lim - a)) if lim > a + b else rates[-1]
                u = rate / per_user; est.append(u)
                why.append(f"{key} queue fit (capacity {mu:,.0f} req/s) -> {u:,.0f}")

    else:
        why.append("latency still flat: queue fit not used")

    fails = [r["users"] for r in runs if not r["ok"]]
    pred = min(est) if est else None
    if pred:
        pred = min(pred, ok[-1]["users"] * 1.5)                 # never more than 1.5x the highest pass
    if pred and fails:
        pred = min(pred, min(fails))
    return pred, "; ".join(why)


def backtest():
    vs = sorted({r["variant"] for r in csv.DictReader(open(TSV), delimiter="\t")})
    print(f"{'variant':22} {'actual':>7} {'from runs':>18} {'predicted':>9} {'error':>6}")
    errs = []
    for v in vs:
        runs = load(v)
        passes = [r for r in runs if r["ok"]]; fails = [r for r in runs if not r["ok"]]
        if not passes or not fails:
            continue
        actual = max(r["users"] for r in passes)
        if min(r["users"] for r in fails) > actual * 1.1:   # not bracketed tightly: skip
            continue
        # pretend we only had the passing runs at or below 85% of the limit
        early = [r for r in passes if r["users"] <= actual * 0.85]
        if len(early) < 2:
            continue
        p, _ = predict(early)
        if not p:
            continue
        e = (p - actual) / actual * 100; errs.append(abs(e))
        print(f"{v:22} {actual:7,} {', '.join(str(r['users']) for r in early)[-18:]:>18} {p:9,.0f} {e:+5.0f}%")
    if errs:
        print(f"\nmedian absolute error {sorted(errs)[len(errs) // 2]:.0f}% over {len(errs)} variants")


if __name__ == "__main__":
    if sys.argv[1:] == ["--backtest"]:
        backtest()
    else:
        for v in sys.argv[1:]:
            p, why = predict(load(v))
            print(f"{v}: predicted max ~{p:,.0f} users ({why})" if p else f"{v}: {why}")
