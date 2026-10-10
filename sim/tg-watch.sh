#!/usr/bin/env bash
# Watches the benchmark queue and sends Telegram updates: each new SCORE, build failures, and "all done".
#   bash sim/tg-watch.sh &
SIM="$(cd "$(dirname "$0")" && pwd)"; R="$SIM/results"
seen="$(mktemp)"; grep -h 'SCORE\|exit build-failed' "$R"/search-*.log 2>/dev/null | sort -u > "$seen"   # already reported
while :; do
  for log in "$R"/search-*.log; do
    grep -h 'SCORE\|exit build-failed' "$log" 2>/dev/null | while read -r line; do
      grep -qxF "$line" "$seen" && continue
      echo "$line" >> "$seen"
      v="$(basename "$log" .log | sed 's/^search-//')"
      hold="$(grep -E '^(PASS|FAIL) .* 5m ' "$log" | grep '^PASS' | tail -1 | cut -d'|' -f1)"
      bash "$SIM/tg-notify.sh" "perf: $v
$line
$hold
queue left: $(tr '\n' ' ' < "$SIM/queue.txt")" >/dev/null
    done
  done
  if ! pgrep -f 'queue-runne[r]' >/dev/null && ! grep -q '[a-z]' "$SIM/queue.txt"; then
    bash "$SIM/tg-notify.sh" "perf: queue finished at $(date +%H:%M). Building the chart and analysis next." >/dev/null
    break
  fi
  sleep 30
done
rm -f "$seen"
