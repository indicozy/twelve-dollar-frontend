# syntax=docker/dockerfile:1
# Ruby on Rails 8.1 + ERB on Puma for the 2-server simulation (sim/): SSR on every request, no caching.
# Based on the Dockerfile `rails new` generates (Rails 8.1.4): same base, jemalloc, BUNDLE_* settings, build stage and
# bootsnap precompile. Changes: + iproute2 (NET_DELAY), runs as root (tc needs it), SECRET_KEY_BASE from the
# environment instead of credentials/RAILS_MASTER_KEY, the NET_DELAY CMD and a healthcheck.

ARG RUBY_VERSION=4.0.7
FROM docker.io/library/ruby:$RUBY_VERSION-slim-trixie AS base

WORKDIR /rails

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 iproute2 && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Production environment, jemalloc (the generator's default).
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development" \
    LD_PRELOAD="/usr/local/lib/libjemalloc.so"

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libyaml-dev pkg-config && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY vendor/* ./vendor/
COPY Gemfile Gemfile.lock ./

RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile -j 1 --gemfile

COPY . .

RUN bundle exec bootsnap precompile -j 1 app/ lib/

FROM base

COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

# Signs/encrypts the cookie session (CSRF token). A public, benchmark-only value: set your own for anything real.
ENV SECRET_KEY_BASE="perf-benchmark-only-not-a-secret-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
    PORT=3000

ENTRYPOINT ["/rails/bin/docker-entrypoint"]

HEALTHCHECK --interval=2s --retries=30 CMD ["curl", "-fsS", "-o", "/dev/null", "http://127.0.0.1:3000/"]
EXPOSE 3000
# Puma via `bin/rails server` (the generator's CMD), bound to 0.0.0.0:3000; config/puma.rb is Rails' default
# (3 threads, WEB_CONCURRENCY unset = single process).
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec ./bin/rails server -b 0.0.0.0 -p 3000"]
