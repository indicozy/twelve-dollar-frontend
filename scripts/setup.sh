#!/usr/bin/env bash
# One-time setup: reference repo + seed DB, local sqlite3/k6 if missing, release builds.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; T="$ROOT/.tools"; mkdir -p "$T" "$ROOT/data"
export PATH="$T:$PATH"

[ -d "$ROOT/research/ref-repo" ] || git clone --depth 1 https://github.com/arjaythedev/twelve-dollar-server-challenge "$ROOT/research/ref-repo"
if ! command -v sqlite3 >/dev/null; then
  curl -fsSL -o "$T/sqlite.zip" https://www.sqlite.org/2025/sqlite-tools-linux-x64-3500400.zip
  (cd "$T" && unzip -o -q sqlite.zip sqlite3 && rm sqlite.zip)
fi
if ! command -v k6 >/dev/null; then
  V=v2.3.0; curl -fsSL "https://github.com/grafana/k6/releases/download/$V/k6-$V-linux-amd64.tar.gz" | tar -xz -C "$T" --strip-components=1 "k6-$V-linux-amd64/k6"
fi
[ -f "$ROOT/research/ref-repo/seed/feed.db" ] || bash "$ROOT/research/ref-repo/seed/make-seed.sh"

bash "$ROOT/backend/build.sh"
(cd "$ROOT/frontends/nextjs" && pnpm install --frozen-lockfile && pnpm build)
echo "setup done"
