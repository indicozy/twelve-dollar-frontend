#!/bin/sh
set -e
# Optional one-way network delay, like the other variants (needs NET_ADMIN).
if [ -n "${NET_DELAY:-}" ]; then tc qdisc replace dev eth0 root netem delay "$NET_DELAY" || true; fi

# Routes, views and events were cached at build time. The config is cached here because it bakes in
# environment values (BACKEND_URL, JWT_SECRET, APP_KEY) that are only known when the container starts.
php artisan config:cache

# PHP-FPM in the foreground of a background job (keeps its log on the container's stderr), nginx as PID 1.
php-fpm -F &
exec nginx -g 'daemon off;'
