#!/usr/bin/env bash
# Copies the pristine seed DB to data/feed.db (every run starts from a fresh copy, like the challenge).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/research/ref-repo/seed/feed.db"
[ -f "$SEED" ] || { echo "no seed: run scripts/setup.sh first"; exit 1; }
rm -f "$ROOT/data/feed.db" "$ROOT/data/feed.db-wal" "$ROOT/data/feed.db-shm"
cp "$SEED" "$ROOT/data/feed.db"
echo "$ROOT/data/feed.db"
