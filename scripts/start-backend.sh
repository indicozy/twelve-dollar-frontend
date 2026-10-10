#!/usr/bin/env bash
# Rust API on 127.0.0.1:4000 over a fresh database copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ "${KEEP_DB:-0}" = 1 ] || bash "$ROOT/scripts/fresh-db.sh" >/dev/null
export SQLITE_PATH="$ROOT/data/feed.db" JWT_SECRET="${JWT_SECRET:-twelve-dollar-challenge}"
export HOST="${HOST:-127.0.0.1}" PORT="${PORT:-4000}"
exec "$ROOT/backend/target/release/feed-server"
