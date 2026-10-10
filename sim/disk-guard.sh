#!/usr/bin/env bash
# Keeps the root disk (where Docker's data lives) from filling up while the queue builds images.
# Every 5 min: under 10 GB free -> prune Docker build cache + dangling (untagged) images; under 5 GB -> also a
# Telegram alert (at most hourly). Never touches volumes or tagged images. Exits when the queue is done.
SIM="$(cd "$(dirname "$0")" && pwd)"; last_alert=0
free_gb() { df --output=avail -BG / | tail -1 | tr -dc 0-9; }
while pgrep -f 'queue-runne[r]' >/dev/null || grep -q '[a-z]' "$SIM/queue.txt"; do
  f=$(free_gb)
  if [ "$f" -lt 10 ]; then
    docker builder prune -f >/dev/null 2>&1; docker image prune -f >/dev/null 2>&1
    echo "$(date +%H:%M) root free ${f}G -> pruned build cache and dangling images, now $(free_gb)G"
  fi
  f=$(free_gb); now=$(date +%s)
  if [ "$f" -lt 5 ] && [ $(( now - last_alert )) -gt 3600 ]; then
    tg-notify "perf: root disk low (${f} GB free) even after pruning Docker build cache. Benchmark may fail; check the machine." >/dev/null 2>&1
    last_alert=$now
  fi
  sleep 300
done
echo "queue done, disk guard exiting at $(date +%H:%M), root free $(free_gb)G"
