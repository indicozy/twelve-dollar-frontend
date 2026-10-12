#!/bin/sh
set -e
# (The NET_DELAY line runs first, in the Dockerfile CMD.)

# Routes, views and events were cached at build time. The config is cached here because it bakes in
# environment values (BACKEND_URL, JWT_SECRET, APP_KEY) that are only known when the container starts.
php artisan config:cache

# Octane's FrankenPHP server: `artisan octane:frankenphp` (a small PHP supervisor) starts `frankenphp run` with
# docker/frankenphp/Caddyfile. OCTANE_WORKERS booted Laravel workers serve every request (worker mode).
# FrankenPHP needs more threads than workers; one spare thread is enough (nothing runs outside the worker).
export FRANKENPHP_NUM_THREADS="${FRANKENPHP_NUM_THREADS:-$((OCTANE_WORKERS + 1))}"
exec php artisan octane:frankenphp --host=0.0.0.0 --port=3000 --admin-port=2019 \
  --workers="$OCTANE_WORKERS" --max-requests="$OCTANE_MAX_REQUESTS" \
  --caddyfile=/var/www/html/docker/frankenphp/Caddyfile
