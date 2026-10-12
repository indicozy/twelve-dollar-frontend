#!/usr/bin/env bash
# Bottleneck-guided search, replacing the binary search: one 2-minute test run at START users (default 2000), read
# which server is the bottleneck (web or api CPU as a share of its vCPU, memory), estimate the user count where that
# resource reaches TARGET% (default 95, where Go's 5-minute hold passed and 100% failed) and jump there, then move up
# or down by 10% of the last run (rounded to STEP=100 users) with 2-minute runs until a pass sits one step below a
# fail (e.g. 10,000 fails, 9,000 passes: done). If a jump overshoots so the pass and fail are further apart
# than one 10% step, it falls back to binary search between them. Confirm with 5-minute holds, stepping down 10% until one passes.
# Above MAX the search stops and reports the CPU-based estimate as such.
#   LO=16000 START=17600 (skip the test run: build on a known 5-minute pass)
#   CPUS=0.4 START=2000 STEP=100 MAX=30000 bash sim/step-search.sh express-bun hono-jsx-bun ...
set -uo pipefail
SIM="$(cd "$(dirname "$0")" && pwd)"
export CPUS="${CPUS:-0.4}"
start="${START:-2000}" step="${STEP:-100}" max="${MAX:-30000}" target="${TARGET:-95}"

r100() { echo $(( ($1 + step / 2) / step * step )); }

# run <vus> <dur>: prints the result line, sets ok (0/1), web, api (share of vCPU %), mem (peak MiB), err
runone() {
  local line
  line="$(FRONTEND="$v" bash "$SIM/sim.sh" run "$1" "$2" 2>&1 | grep -E '^(PASS|FAIL)' | tail -1)"
  echo "$line" | tee -a "$log"
  [[ "$line" == PASS* ]] && ok=1 || ok=0
  web="$(grep -oP 'web cpu [0-9]+% under load \(\K[0-9]+' <<<"$line" || echo 0)"
  api="$(grep -oP 'api cpu [0-9]+% under load \(\K[0-9]+' <<<"$line" || echo 0)"
  mem="$(grep -oP 'web cpu.*?/ \K[0-9]+(?= MiB peak)' <<<"$line" || echo 0)"
}

# estimate users where the bottleneck reaches target%, from (u1,c1) and optionally (u0,c0)
estimate() {
  python3 -I - "$@" <<'EOF'
import sys
t, u1, c1, *prev = map(float, sys.argv[1:])
if prev and prev[0] != u1 and c1 != prev[1]:
    u0, c0 = prev
    a = (c1 - c0) / (u1 - u0); b = c1 - a * u1
    est = (t - b) / a if a > 0 else u1 * t / max(c1, 1)
else:
    est = u1 * t / max(c1, 1)
print(int(max(est, 100)))
EOF
}

for v in "$@"; do
  log="$SIM/results/step-$v-cpu$CPUS.log"
  echo "== $(date +%H:%M:%S) $v (step search: start $start, step $step, cap $max, target $target%)" | tee "$log"
  FRONTEND="$v" bash "$SIM/sim.sh" up >> "$log" 2>&1 || { echo "$v: build failed" | tee -a "$log"; continue; }

  n=$start; lo=${LO:-0}; hi=0; runs=0                # LO: a known (historic) 5-minute pass to build on
  while :; do
    runone "$n" 2m; runs=$((runs + 1))
    b=$web; who=web; [ "$api" -gt "$web" ] && { b=$api; who=api; }
    if [ "$ok" = 1 ]; then [ "$n" -gt "$lo" ] && lo=$n; else { [ "$hi" = 0 ] || [ "$n" -lt "$hi" ]; } && hi=$n; fi
    note="bottleneck: $who CPU at $b% of its vCPU (web $web%, api $api%), web memory peak ${mem} MiB of 2048"
    [ "$ok" = 0 ] && [ "$b" -lt 85 ] && note="$note; failed below 85% CPU, so CPU is not what broke it (check k6.log)"
    echo "   $note" | tee -a "$log"
    if [ "$lo" != 0 ] && [ "$hi" != 0 ]; then                  # bracketed by a pass and a fail
      g=$(r100 $((lo / 10))); [ "$g" -lt "$step" ] && g=$step
      [ $((hi - lo)) -le "$g" ] && break                         # within one 10% step: done
      n=$(r100 $(( (lo + hi) / 2 )))                            # prediction was off: fall back to binary search
      { [ "$n" -le "$lo" ] || [ "$n" -ge "$hi" ]; } && break
      echo "   prediction off (pass $lo, fail $hi): binary search -> $n users" | tee -a "$log"
      runs_left=$((25 - runs)); [ "$runs_left" -le 0 ] && break
      continue
    fi
    if [ "$ok" = 1 ] && [ "$n" -ge "$max" ]; then
      echo "   at the cap: estimated limit ~$(r100 "$(estimate "$target" "$n" "$b")") users (beyond MAX=$max, not measured)" | tee -a "$log"; break
    fi
    d=$(r100 $((n / 10))); [ "$d" -lt "$step" ] && d=$step     # 10% of this run, in 100-user units
    if [ "$runs" = 1 ]; then                                    # first run: jump to the bottleneck estimate
      est="$(r100 "$(estimate "$target" "$n" "$b")")"; [ "$est" -gt "$max" ] && est=$max
      if [ "$ok" = 1 ]; then [ "$est" -gt "$n" ] && n=$est || n=$((n + d)); else [ "$est" -lt "$n" ] && n=$est || n=$((n - d)); fi
    else
      [ "$ok" = 1 ] && n=$((n + d)) || n=$((n - d))
      if [ "$ok" = 1 ]; then                                    # passed: jump ahead if sim/predict.py (CPU line +
        pred="$(python3 -I "$SIM/predict.py" "$v" | grep -oP 'max ~\K[0-9,]+' | tr -d ,)"   # queueing fit) is higher
        if [ -n "$pred" ]; then
          pred="$(r100 "$pred")"; echo "   predict.py: ~$pred users" | tee -a "$log"
          [ "$pred" -gt "$n" ] && n=$pred
        fi
      fi
    fi
    [ "$n" -gt "$max" ] && n=$max
    [ "$n" -lt "$step" ] && { echo "   nothing passed" | tee -a "$log"; break; }
    echo "   next: $n users" | tee -a "$log"
    [ "$runs" -ge 25 ] && { echo "   stopping after 25 runs" | tee -a "$log"; break; }
  done
  [ "$lo" = 0 ] && { echo "$v: no 2-minute pass" | tee -a "$log"; continue; }

  if [ -n "${LO:-}" ] && [ "$lo" = "$LO" ]; then
    echo "SCORE $v-cpu$CPUS: $lo users (historic 5-minute pass; nothing above it passed)" | tee -a "$log" | tee -a "$SIM/results/runs.log"; continue
  fi
  n=$lo; echo "== confirm (5-minute holds from $n, stepping down 10%)" | tee -a "$log"
  while :; do
    runone "$n" 5m
    [ "$ok" = 1 ] && break
    d=$(r100 $((n / 10))); [ "$d" -lt "$step" ] && d=$step; n=$((n - d)); [ "$n" -lt "$step" ] && break
  done
  if [ "$ok" = 1 ]; then
    cap=""; [ "$n" -ge "$max" ] && cap=" (cap MAX=$max, real limit not reached)"
    echo "SCORE $v-cpu$CPUS: $n users$cap" | tee -a "$log" | tee -a "$SIM/results/runs.log"
  else
    echo "$v: no 5-minute hold passed" | tee -a "$log"
  fi
done
echo "step search done at $(date +%H:%M:%S)"
