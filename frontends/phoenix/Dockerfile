# Phoenix 1.8 + HEEx (dead views, plain controllers) for the 2-server simulation (sim/): SSR on every request, no
# caching, one BEAM OS process. Two stages like `mix phx.gen.release --docker`: build a mix release on the hexpm/elixir
# image, run it on the matching Debian slim image (the release bundles ERTS, so no Erlang/Elixir install at runtime).
ARG BUILDER_IMAGE=hexpm/elixir:1.20.4-erlang-29.1.1-debian-bookworm-20261005-slim
ARG RUNNER_IMAGE=debian:bookworm-20261005-slim

FROM ${BUILDER_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV MIX_ENV=prod
RUN mix local.hex --force && mix local.rebar --force
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
COPY config/config.exs config/prod.exs config/
RUN mix deps.compile
COPY lib lib
COPY priv priv
COPY rel rel
COPY config/runtime.exs config/
RUN mix compile && mix release

FROM ${RUNNER_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 locales ca-certificates \
      iproute2 curl libsctp1 \
    && rm -rf /var/lib/apt/lists/* \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8
WORKDIR /app
RUN chown nobody /app
ENV MIX_ENV=prod PHX_SERVER=true HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=nobody:root /app/_build/prod/rel/feed ./
# Runs as root (not the generator's `nobody`) so the NET_DELAY `tc` line works, like the other variants.
HEALTHCHECK --interval=2s --retries=30 CMD curl -sf -o /dev/null http://127.0.0.1:3000/ || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || true; fi; exec /app/bin/feed start"]
