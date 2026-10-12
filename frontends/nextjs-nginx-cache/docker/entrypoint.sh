#!/bin/sh
set -e
# Optional one-way network delay, like the other variants (needs NET_ADMIN).
if [ -n "${NET_DELAY:-}" ]; then tc qdisc replace dev eth0 root netem delay "$NET_DELAY" || true; fi

# Next.js standalone server on loopback (background job, logs on the container's stderr), nginx as PID 1.
# If Node exits, stop the container instead of leaving nginx answering 502.
( HOSTNAME=127.0.0.1 PORT=3001 node server.js; echo "next server exited ($?)" >&2; kill -TERM 1 ) &
exec nginx -g 'daemon off;'
