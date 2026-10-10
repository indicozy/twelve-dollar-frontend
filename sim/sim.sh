#!/usr/bin/env bash
# Two-droplet simulation: api (Rust + SQLite) and web (SSR frontend), each 1 vCPU / 2 GB / no swap.
#
#   bash sim/sim.sh up                       # build + start api and web (waits for healthy)
#   bash sim/sim.sh run 2000                 # one SSR load run at 2,000 users (fresh DB), prints pass/fail
#   bash sim/sim.sh run 2000 2m              #   ... with a 2-minute hold instead of 5m
#   bash sim/sim.sh search                   # the video's procedure: warm-up, double/bisect (2m), 5m confirm
#   bash sim/sim.sh throughput /             # raw req/s on one frontend path (64 conns, 30s)
#   bash sim/sim.sh stats                    # live CPU / memory of both servers
#   bash sim/sim.sh down
#
# TARGET=api runs the challenge's own load.js straight against the Rust API (calibration vs the video).
# Knobs: CPUS, MEM, STEP (search precision, 250), MAX (user cap, 0 = none), AUTO_START (probe for the start, 1),
#        START (used when AUTO_START=0), LO + HI (resume: bisect between a known 2-minute pass and fail), WARMUP (1 = 2-minute warm-up first), HOLD_FAIL (skip the 2-minute search and
#        binary-search 5-minute holds below a known failing user count), API_CPU, WEB_CPU, K6_CPUS, NET_DELAY, FRONTEND (see docker-compose.yml), RAMP_UP.
set -euo pipefail
SIM="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SIM")"
DC=(docker compose -f "$SIM/docker-compose.yml")
TARGET="${TARGET:-web}"
FRONTEND="${FRONTEND:-nextjs}"; export FRONTEND

if [ "$TARGET" = api ]; then
  SCRIPT=/perf/challenge-bench/load.js; BASE_URL=http://api:4000; LABEL=api
else
  # client-side-rendered variants (frontends/*-csr) are measured as a browser would load them
  case "$FRONTEND" in *-csr) SCRIPT=/perf/bench/csr-load.js ;; nextjs-smart) SCRIPT=/perf/bench/smart-load.js ;; *) SCRIPT=/perf/bench/ssr-load.js ;; esac
  BASE_URL=http://web:3000; LABEL="$FRONTEND"
fi
VARIANT="$LABEL"
export CPUS="${CPUS:-1.0}" MEM="${MEM:-2g}"
LABEL="$LABEL-cpu$CPUS"; [ "$MEM" != 2g ] && LABEL="$LABEL-mem$MEM"   # non-default memory gets its own label

need() {
  [ -x "$ROOT/.tools/k6" ] || { echo "missing .tools/k6: run scripts/setup.sh"; exit 1; }
  [ -f "$ROOT/research/ref-repo/seed/feed.db" ] || { echo "missing seed DB: run scripts/setup.sh"; exit 1; }
}

up() { need; "${DC[@]}" up -d --build --wait api web; }

# Fresh database + a fresh web container (recreated, so pages regenerated during the last run are gone too).
reset() {
  { "${DC[@]}" restart api && "${DC[@]}" up -d --wait api && "${DC[@]}" up -d --force-recreate --wait web; } >/dev/null 2>&1
}

# Samples `docker stats` every 2s into $1 until killed.
sample_stats() {
  while true; do
    docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' perf-sim-api-1 perf-sim-web-1 2>/dev/null \
      | sed "s/^/$(date +%s),/"
    sleep 2
  done >> "$1"
}

# run <vus> [duration] -> prints one result line, returns 0 on pass
run() {
  local vus="$1" dur="${2:-5m}" ts out rc=0 pid
  need; reset
  ts="$(date +%Y%m%d-%H%M%S)"; out="$SIM/results/$ts-$LABEL-${vus}vu-$dur"; mkdir -p "$out"
  echo "time,container,cpu,mem" > "$out/stats.csv"
  sample_stats "$out/stats.csv" & pid=$!
  "${DC[@]}" run --rm -T k6 run -q --summary-export "/results/$(basename "$out")/summary.json" \
    -e BASE_URL="$BASE_URL" -e VUS="$vus" -e DURATION="$dur" -e RAMP_UP="${RAMP_UP:-60s}" "$SCRIPT" \
    > "$out/k6.log" 2>&1 || rc=$?
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null || true
  report "$out" "$vus" "$dur" "$rc"
  return "$rc"
}

report() {
  local out="$1" vus="$2" dur="$3" rc="$4" s="$1/summary.json" verdict cpu
  [ "$rc" = 0 ] && verdict=PASS || verdict=FAIL
  # CPU under full load (share of the vCPU budget), peak CPU, average/peak memory per server
  cpu="$(python3 -I "$SIM/results-table.py" --run "$out")"
  if [ -f "$s" ]; then
    record "$out" "$vus" "$dur" "$verdict"
    jq -r --arg v "$verdict" --arg vus "$vus" --arg d "$dur" --arg cpu "$cpu" '
      .metrics as $m | "\($v)  \($vus) users \($d)  \($m.http_reqs.rate|floor) req/s  med \($m.http_req_duration.med|floor)ms  p95 \($m.http_req_duration["p(95)"]|floor)ms  p99 \($m.http_req_duration["p(99)"]|floor)ms  errors \(($m.http_req_failed.value*10000|floor)/100)%  |  \($cpu)"' "$s" \
      | tee -a "$SIM/results/runs.log"
  else
    echo "$verdict  $vus users $dur  (no summary, see $out/k6.log)" | tee -a "$SIM/results/runs.log"
    tail -5 "$out/k6.log"
  fi
}

# results/results.tsv is rebuilt from every run folder: load-window CPU, CPU as a share of the vCPU budget,
# average and peak memory per server (see results-table.py).
record() { python3 -I "$SIM/results-table.py" >/dev/null; }

# The video's method with three speed-ups that don't change how any scored run is measured:
#  1. No warm-up by default (WARMUP=1 restores it): every run recreates the web container, so a warm-up never
#     carried over anyway.
#  2. A 20-second throughput probe picks the starting point (AUTO_START=0 uses START instead): saturated req/s is
#     converted to users at 75% of saturation, using the load script's requests per user.
#  3. Binary search everywhere: bracket the limit with ±25% jumps, bisect to STEP with 2-minute runs, then confirm
#     with a 5-minute hold. If the hold fails, jump down by a quarter until one passes, then bisect between the
#     passing and failing holds. STEP is only the final precision, never the stride.
# Pass/fail thresholds, run lengths and the 5-minute hold are unchanged. MAX caps the user count.
round_down() { local v=$(( $1 / step * step )); [ "$v" -lt "$step" ] && v=$step; echo "$v"; }
round_up()   { echo $(( ($1 + step - 1) / step * step )); }

# Prints a starting user count from a 20 s saturated-throughput probe of the main page.
probe() {
  local f base url per_user rps start
  reset
  f="probe-$LABEL-$(date +%Y%m%d-%H%M%S).json"
  if [ "$TARGET" = api ]; then base=http://api:4000; url=/feed; per_user=100   # load.js: ~0.10 req/s per user (x1000)
  else base=http://web:3000; url=/
    case "$SCRIPT" in *csr-load.js) per_user=200 ;; *smart-load.js) per_user=184 ;; *) per_user=92 ;; esac  # csr ~0.20, smart ~0.18, ssr ~0.092
  fi
  "${DC[@]}" run --rm -T k6 run -q --summary-export "/results/$f" -e URL="$base$url" -e CONNS=64 -e DURATION=20s \
    /perf/bench/throughput.js >/dev/null 2>&1
  rps="$(jq -r '.metrics.http_reqs.rate | floor' "$SIM/results/$f" 2>/dev/null || echo 0)"
  rm -f "$SIM/results/$f"
  start=$(( rps * 750 / per_user ))                      # 75% of saturation, in users
  echo "== probe: ${rps} req/s saturated on $url -> start at about $start users" >&2
  echo "$start"
}

search() {
  local step="${STEP:-250}" max="${MAX:-0}" lo=0 hi=0 n next
  if [ "${WARMUP:-0}" = 1 ]; then echo "== warm-up (1000 users, 2m, not scored)"; run 1000 2m || true; fi
  if [ -n "${HOLD_FAIL:-}" ]; then                    # resume: a 5-minute hold already failed at HOLD_FAIL users
    lo=0; n=0
  elif [ -n "${LO:-}" ] && [ -n "${HI:-}" ]; then     # resume: known clean 2-minute pass (LO) and fail (HI); bisect
    lo=$LO; hi=$HI; n=$(( (LO + HI) / 2 / ${STEP:-250} * ${STEP:-250} ))
  elif [ "${AUTO_START:-1}" = 1 ]; then n="$(probe)"; else n="${START:-2500}"; fi
  n="$(round_down "$n")"
  [ "$max" -gt 0 ] && [ "$n" -gt "$max" ] && n=$max
  if [ -z "${HOLD_FAIL:-}" ]; then
  echo "== search (start $n, step $step${max:+, cap $max})"
  while :; do
    if run "$n" 2m; then
      lo=$n
      if [ "$hi" = 0 ]; then
        [ "$max" -gt 0 ] && [ "$lo" -ge "$max" ] && { echo "== reached the cap (MAX=$max users)"; break; }
        next="$(round_up $(( n * 5 / 4 )))"; [ "$next" -le "$n" ] && next=$(( n + step ))
        [ "$max" -gt 0 ] && [ "$next" -gt "$max" ] && next=$max
      fi
    else
      hi=$n
      if [ "$lo" = 0 ]; then
        next="$(round_down $(( n * 4 / 5 )))"
        [ "$next" -ge "$n" ] && { [ "$n" -le "$step" ] && { echo "nothing passed even at $n users"; return 1; }; next=$(( n - step )); }
      fi
    fi
    if [ "$lo" != 0 ] && [ "$hi" != 0 ]; then
      [ $(( hi - lo )) -le "$step" ] && break
      next=$(( (lo + hi) / 2 / step * step )); [ "$next" -le "$lo" ] && next=$(( lo + step ))
      [ "$next" -ge "$hi" ] && break
    fi
    n=$next
  done
  [ "$lo" = 0 ] && { echo "nothing passed"; return 1; }
  fi

  local hp=0 hf=0
  if [ -n "${HOLD_FAIL:-}" ]; then
    hf=$HOLD_FAIL; n="$(round_down $(( hf * 3 / 4 )))"
    echo "== confirm (resuming: a 5-minute hold failed at $hf users; binary holds from $n)"
  else
    n=$lo; echo "== confirm (5-minute holds, starting at $lo)"
  fi
  while :; do
    if run "$n" 5m; then hp=$n; else hf=$n; fi
    if [ "$hp" != 0 ] && [ "$hf" = 0 ]; then break; fi                     # first hold passed
    if [ "$hp" != 0 ] && [ "$hf" != 0 ]; then
      [ $(( hf - hp )) -le "$step" ] && break
      n=$(( (hp + hf) / 2 / step * step )); [ "$n" -le "$hp" ] && n=$(( hp + step )); [ "$n" -ge "$hf" ] && break
    else                                                                     # only failures so far: binary drop,
      next="$(round_down $(( n * 3 / 4 )))"                                  # halfway towards half the users
      [ "$next" -ge "$n" ] && next=$(( n - step ))
      [ "$next" -lt "$step" ] && { echo "no 5-minute hold passed"; return 1; }
      n=$next
    fi
  done
  local capped=""; [ "$max" -gt 0 ] && [ "$hp" -ge "$max" ] && capped=" (cap MAX=$max, real limit not reached)"
  echo "SCORE $LABEL: $hp users$capped"; echo "SCORE $LABEL: $hp users$capped" >> "$SIM/results/runs.log"
}

throughput() {
  need; reset
  local url="${1:-/}" base
  [ "$TARGET" = api ] && base=http://api:4000 || base=http://web:3000
  "${DC[@]}" run --rm -T k6 run -q -e URL="$base$url" -e CONNS="${CONNS:-64}" -e DURATION="${DURATION:-30s}" /perf/bench/throughput.js 2>&1 \
    | grep -E "http_reqs|http_req_duration|http_req_failed"
}

case "${1:-}" in
  up) up ;;
  down) "${DC[@]}" down -v ;;
  run) shift; run "${1:?usage: sim.sh run <vus> [duration]}" "${2:-5m}" ;;
  search) search ;;
  throughput) shift; throughput "${1:-/}" ;;
  stats) docker stats perf-sim-api-1 perf-sim-web-1 ;;
  logs) "${DC[@]}" logs -f api web ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
