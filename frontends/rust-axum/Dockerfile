# Rust / Axum + Askama frontend for the 2-server simulation (sim/): SSR on every request, no caching, one process
# (Tokio multi-threaded runtime). Built inside bookworm so glibc matches the runtime image.
FROM rust:1.90-slim-bookworm AS build
WORKDIR /src
# Dependency layer: build all crates against a dummy main so source edits don't rebuild them.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main(){}' > src/main.rs && cargo build --release --locked && rm -rf src
# Templates and the stylesheet are compiled into the binary (askama derive, include_str!).
COPY templates ./templates
COPY static ./static
COPY src ./src
RUN touch src/main.rs && cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl iproute2 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/feed-frontend /usr/local/bin/feed-frontend
ENV HOST=0.0.0.0 PORT=3000
HEALTHCHECK --interval=2s --retries=30 CMD curl -sf http://127.0.0.1:3000/ >/dev/null || exit 1
EXPOSE 3000
CMD ["sh", "-c", "if [ -n \"${NET_DELAY:-}\" ]; then tc qdisc replace dev eth0 root netem delay \"$NET_DELAY\" || echo 'netem unavailable'; fi; exec feed-frontend"]
