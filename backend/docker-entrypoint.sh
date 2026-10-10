#!/bin/sh
# Every container start = fresh copy of the seed DB (like the challenge), optional network delay, then the server.
set -eu
if [ -f /seed/feed.db ]; then
  rm -f "$SQLITE_PATH" "$SQLITE_PATH-wal" "$SQLITE_PATH-shm"
  cp /seed/feed.db "$SQLITE_PATH"
fi
if [ -n "${NET_DELAY:-}" ]; then tc qdisc replace dev eth0 root netem delay "$NET_DELAY" || echo "netem unavailable"; fi
exec feed-server
