#!/usr/bin/env bash
# Same-load latency comparison: every variant at a fixed user count (default 400, below every variant's limit),
# one 3-minute run each (after the usual 60 s ramp-up), fresh DB and web container per run like every other run.
# Results land in sim/results/ like any run (hold label "3m", so they never mix with the 2m search / 5m hold runs).
#   VUS=400 bash sim/fixed-load.sh nextjs remix express ...
set -uo pipefail
SIM="$(cd "$(dirname "$0")" && pwd)"
export CPUS="${CPUS:-0.4}"; vus="${VUS:-400}"
for v in "$@"; do
  echo "== $(date +%H:%M:%S) $v"
  if FRONTEND="$v" bash "$SIM/sim.sh" up > "$SIM/results/fixed-$v.log" 2>&1; then
    FRONTEND="$v" bash "$SIM/sim.sh" run "$vus" 3m 2>&1 | tail -1
  else
    echo "$v: build failed (see sim/results/fixed-$v.log)"
  fi
done
echo "fixed-load done at $(date +%H:%M:%S)"
