# Laravel 13 + Blade on Laravel Octane (FrankenPHP worker mode), tuned, for the 2-server simulation (sim/).
# ../laravel-octane plus the production tuning a Laravel team would apply (see README.md): keep-alive to the API,
# cookie sessions, no XSRF-TOKEN cookie, trimmed Octane listeners, no view timestamp checks, a Blade partial for the
# post card, OPcache JIT. Every page is still rendered from a fresh API call (no HTML or data caching).

# --- dependencies (Composer's image runs PHP 8.5.11 too) ---
FROM composer:2.10.3 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY . .
# --optimize builds the classmap; the post-autoload-dump script runs `artisan package:discover`.
RUN composer dump-autoload --no-dev --optimize

# --- runtime: official FrankenPHP image (PHP 8.5.11 ZTS, Caddy 2.11.7, Debian trixie) ---
FROM dunglas/frankenphp:1.13.1-php8.5.11-trixie
RUN apt-get update \
 && apt-get install -y --no-install-recommends iproute2 \
 && rm -rf /var/lib/apt/lists/*
# The image has every extension Laravel needs (ctype, curl, dom, fileinfo, filter, iconv, mbstring, openssl, session,
# tokenizer, ...); OPcache is built into PHP 8.5. Octane's `octane:frankenphp` supervisor command needs pcntl
# (signal handling), which is bundled with PHP's source (so it is 8.5.11 too).
RUN docker-php-ext-install pcntl
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php/zz-production.ini $PHP_INI_DIR/conf.d/zz-production.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html

# Benchmark-only APP_KEY (encrypts the session cookies). Override it with -e APP_KEY=... for anything real.
# OCTANE_WORKERS: Octane's `auto` would size by the host's cores, not the container's 0.4 CPU (see README).
ENV APP_ENV=production \
    APP_DEBUG=false \
    APP_KEY=base64:Ah7VTzoKdkyKH1KmMOeKed73eWULYUfEGO5g7V8N2w0= \
    LOG_CHANNEL=stderr \
    SESSION_DRIVER=cookie \
    CACHE_STORE=file \
    QUEUE_CONNECTION=sync \
    OCTANE_SERVER=frankenphp \
    OCTANE_WORKERS=2 \
    OCTANE_MAX_REQUESTS=500 \
    BACKEND_URL=http://127.0.0.1:4000 \
    JWT_SECRET=twelve-dollar-challenge \
    XDG_CONFIG_HOME=/tmp/caddy-config \
    XDG_DATA_HOME=/tmp/caddy-data

# Production caches that don't depend on runtime env (config:cache runs in the entrypoint).
RUN php artisan route:cache && php artisan view:cache && php artisan event:cache

HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
ENTRYPOINT []
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec /usr/local/bin/entrypoint.sh"]
