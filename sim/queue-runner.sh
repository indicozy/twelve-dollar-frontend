#!/usr/bin/env bash
# Runs the max-users search for each line of sim/queue.txt, one at a time, until the file is empty.
# A line is a variant plus optional settings, e.g. `nuxt` or `nextjs-csr START=16000`.
# Lines can be added, removed or reordered while it runs. Each variant: `sim.sh up` (builds its image), then `sim.sh search`.
#   CPUS=0.4 START=1000 STEP=100 MAX=16000 bash sim/queue-runner.sh
set -uo pipefail
SIM="$(cd "$(dirname "$0")" && pwd)"; Q="$SIM/queue.txt"
export CPUS="${CPUS:-0.4}" START="${START:-1000}" STEP="${STEP:-100}" MAX="${MAX:-16000}"
while :; do
  ln="$(grep -n -m1 -v '^\s*$' "$Q" 2>/dev/null | cut -d: -f1)"
  [ -z "$ln" ] && break
  line="$(sed -n "${ln}p" "$Q")"; sed -i "${ln}d" "$Q"            # pop it
  read -r v settings <<< "$line"
  log="$SIM/results/search-$v-cpu$CPUS.log"
  echo "== $(date +%H:%M:%S) building $v ${settings:-}" > "$log"
  if env ${settings:-} FRONTEND="$v" bash "$SIM/sim.sh" up >> "$log" 2>&1; then
    env ${settings:-} FRONTEND="$v" bash "$SIM/sim.sh" search >> "$log" 2>&1; rc=$?
  else
    rc=build-failed
  fi
  echo "== $(date +%H:%M:%S) $v search exit $rc" >> "$log"
  echo "$v: $(grep -m1 SCORE "$log" || echo "no score (exit $rc)")"
done
echo "queue empty at $(date +%H:%M:%S)"
