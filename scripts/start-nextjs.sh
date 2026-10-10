#!/usr/bin/env bash
# Next.js standalone server on 127.0.0.1:3000, talking to the API at $BACKEND_URL.
set -euo pipefail
APP="$(cd "$(dirname "$0")/../frontends/nextjs" && pwd)"
S="$APP/.next/standalone"
[ -f "$S/server.js" ] || { echo "build first: (cd frontends/nextjs && pnpm build)"; exit 1; }
# standalone output doesn't include static assets; copy them next to server.js
rm -rf "$S/.next/static" && cp -r "$APP/.next/static" "$S/.next/static"
[ -d "$APP/public" ] && rm -rf "$S/public" && cp -r "$APP/public" "$S/public"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:4000}" JWT_SECRET="${JWT_SECRET:-twelve-dollar-challenge}"
export HOSTNAME="${HOST:-127.0.0.1}" PORT="${PORT:-3000}" NODE_ENV=production
exec node "$S/server.js"
