# Laravel 13 + Blade on PHP-FPM 8.5 behind nginx, both in one container, for the 2-server simulation (sim/).
# Every page is rendered on every request from a fresh API call (no data caching).

# --- dependencies (Composer's image runs PHP 8.5.11 too) ---
FROM composer:2.10.3 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY . .
# --optimize builds the classmap; the post-autoload-dump script runs `artisan package:discover`.
RUN composer dump-autoload --no-dev --optimize

# --- runtime: official php-fpm image (Debian trixie) + nginx from apt ---
FROM php:8.5.11-fpm-trixie
RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx iproute2 curl \
 && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled /etc/nginx/conf.d \
 && mkdir -p /run/php
# The image already has every extension Laravel needs (ctype, dom, fileinfo, filter, iconv, mbstring, openssl,
# session, tokenizer, ...); OPcache is built into PHP 8.5. No database extension is used.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" && rm -f /usr/local/etc/php-fpm.d/*.conf
COPY docker/php/zz-production.ini $PHP_INI_DIR/conf.d/zz-production.ini
COPY docker/php-fpm/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html

# Benchmark-only APP_KEY (encrypts the session/XSRF cookies). Override it with -e APP_KEY=... for anything real.
ENV APP_ENV=production \
    APP_DEBUG=false \
    APP_KEY=base64:Ah7VTzoKdkyKH1KmMOeKed73eWULYUfEGO5g7V8N2w0= \
    LOG_CHANNEL=stderr \
    SESSION_DRIVER=file \
    CACHE_STORE=file \
    QUEUE_CONNECTION=sync \
    BACKEND_URL=http://127.0.0.1:4000 \
    JWT_SECRET=twelve-dollar-challenge

# Production caches that don't depend on runtime env (config:cache runs in the entrypoint).
RUN php artisan route:cache && php artisan view:cache && php artisan event:cache \
 && chown -R www-data:www-data storage bootstrap/cache

HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
